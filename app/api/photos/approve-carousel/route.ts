import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  describeCarouselPhotos,
  generateImageWithGeminiWithRetry,
  GoogleAIError,
  ImageGenerationConfig
} from '@/lib/google-ai'
import { generateImageWithWavespeed, WavespeedError } from '@/lib/wavespeed'
import { removeExifFromBuffer } from '@/lib/exif-remover'

/**
 * Telecharge une image depuis une URL et retourne le buffer
 */
async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Recupere la photo de reference depuis la base de donnees (base64)
 * Retourne le base64 pur (sans le prefixe data:...)
 */
async function getReferencePhotoBase64(): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key: 'reference_photo_base64' }
  })

  if (!setting?.value) {
    return null
  }

  // Extraire le base64 pur si c'est un data URL
  let base64Data = setting.value
  if (base64Data.startsWith('data:')) {
    const matches = base64Data.match(/^data:[^;]+;base64,(.+)$/)
    if (matches) {
      base64Data = matches[1]
    }
  }

  return base64Data
}

/**
 * Recupere la configuration de generation depuis les Settings
 */
interface GenerationSettings {
  provider: 'gemini' | 'wavespeed'
  aspectRatio: '9:16' | '1:1' | '16:9'
  imageSize: '1K' | '2K' | '4K'
}

async function getGenerationSettings(): Promise<GenerationSettings> {
  try {
    const [providerSetting, aspectRatioSetting, imageSizeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'image_provider' } }),
      prisma.settings.findUnique({ where: { key: 'image_aspect_ratio' } }),
      prisma.settings.findUnique({ where: { key: 'image_size' } }),
    ])

    return {
      provider: (providerSetting?.value as 'gemini' | 'wavespeed') || 'gemini',
      aspectRatio: (aspectRatioSetting?.value as '9:16' | '1:1' | '16:9') || '9:16',
      imageSize: (imageSizeSetting?.value as '1K' | '2K' | '4K') || '2K',
    }
  } catch {
    // Valeurs par defaut en cas d'erreur
    return { provider: 'gemini', aspectRatio: '9:16', imageSize: '2K' }
  }
}

/**
 * POST /api/photos/approve-carousel
 * Workflow carrousel complet :
 * 1. Recuperer toutes les photos du carrousel
 * 2. Les envoyer a describeCarouselPhotos() pour obtenir les prompts
 * 3. Generer l'IMAGE 1 avec : photo de reference + prompt 1
 * 4. Generer les images 2, 3, 4... avec : IMAGE GENEREE 1 (pas la reference!) + prompt N
 *
 * C'est crucial : les images 2+ utilisent l'image generee 1 comme input pour garantir la coherence visuelle.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photoIds } = body as { photoIds: string[] }

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: 'photoIds est requis et doit etre un tableau non vide' },
        { status: 400 }
      )
    }

    // 1. Recuperer toutes les photos triees par carouselIndex
    const photos = await prisma.sourcePhoto.findMany({
      where: { id: { in: photoIds } },
      orderBy: { carouselIndex: 'asc' }
    })

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Aucune photo trouvee' },
        { status: 404 }
      )
    }

    // Verifier que toutes les photos ont une URL
    for (const photo of photos) {
      if (!photo.originalUrl) {
        return NextResponse.json(
          { error: `Photo ${photo.id} n'a pas d'URL source` },
          { status: 400 }
        )
      }
    }

    // 2. Verifier la photo de reference
    const referenceBase64 = await getReferencePhotoBase64()

    if (!referenceBase64) {
      return NextResponse.json(
        { error: 'Configurez d\'abord votre photo de reference dans Settings' },
        { status: 400 }
      )
    }

    // 3. Approuver toutes les photos
    await prisma.sourcePhoto.updateMany({
      where: { id: { in: photoIds } },
      data: { status: 'approved' }
    })

    console.log(`Carousel: ${photos.length} photos approved`)

    // 4. Telecharger toutes les images sources
    const imageBuffers: Buffer[] = []
    for (const photo of photos) {
      try {
        const buffer = await downloadImageFromUrl(photo.originalUrl!)
        imageBuffers.push(buffer)
      } catch (error) {
        console.error(`Error downloading image for photo ${photo.id}:`, error)
        return NextResponse.json(
          { error: `Impossible de telecharger l'image source pour la photo ${photo.id}` },
          { status: 500 }
        )
      }
    }

    console.log(`Carousel: ${imageBuffers.length} images downloaded`)

    // 5. Generer les prompts via describeCarouselPhotos
    const prompts = await describeCarouselPhotos(imageBuffers)

    console.log(`Carousel: ${prompts.length} prompts generated`)

    // 6. Sauvegarder les prompts dans chaque SourcePhoto
    for (let i = 0; i < photos.length; i++) {
      await prisma.sourcePhoto.update({
        where: { id: photos[i].id },
        data: { generatedPrompt: prompts[i] }
      })
    }

    // 7. Recuperer les settings de generation
    const settings = await getGenerationSettings()
    const provider = settings.provider

    console.log(`Carousel: Starting generation with provider: ${provider}`)

    // 8. Generer l'image 1 avec la photo de reference + prompt[0]
    let generatedImage1Buffer: Buffer
    const imageConfig: ImageGenerationConfig = {
      aspectRatio: settings.aspectRatio,
      imageSize: settings.imageSize,
    }

    if (provider === 'wavespeed') {
      generatedImage1Buffer = await generateImageWithWavespeed(
        '/api/images/reference',
        prompts[0],
        settings.aspectRatio || '9:16',
        'png'
      )
    } else {
      generatedImage1Buffer = await generateImageWithGeminiWithRetry(
        referenceBase64,
        prompts[0],
        imageConfig,
        3,
        5000
      )
    }

    console.log('Carousel: Image 1 generated')

    // Supprimer les metadonnees EXIF de l'image 1
    const cleanImage1Data = await removeExifFromBuffer(generatedImage1Buffer)
    const image1Base64 = cleanImage1Data.toString('base64')

    // Determiner le carouselId (utiliser celui des sources ou en creer un nouveau)
    const carouselId = photos[0].carouselId || `carousel_${Date.now()}`
    const carouselTotal = photos.length

    // 9. Creer l'entree GeneratedPhoto pour l'image 1
    const generatedPhoto1 = await prisma.generatedPhoto.create({
      data: {
        sourcePhotoId: photos[0].id,
        prompt: prompts[0],
        localPath: `/api/images/generated/`,
        imageData: `data:image/jpeg;base64,${image1Base64}`,
        isCarousel: true,
        carouselId,
        carouselIndex: 0,
        carouselTotal,
      }
    })

    // Mettre a jour localPath avec l'ID reel
    await prisma.generatedPhoto.update({
      where: { id: generatedPhoto1.id },
      data: { localPath: `/api/images/generated/${generatedPhoto1.id}` }
    })

    console.log(`Carousel: GeneratedPhoto 1 created with id ${generatedPhoto1.id}`)

    // 10. Generer les images 2, 3, 4... avec IMAGE 1 comme input (pas la reference!)
    const generatedPhotos = [generatedPhoto1]

    for (let i = 1; i < photos.length; i++) {
      console.log(`Carousel: Generating image ${i + 1}/${photos.length}`)

      let generatedImageBuffer: Buffer

      if (provider === 'wavespeed') {
        // Pour Wavespeed, on doit utiliser l'URL de l'image generee 1
        // On utilise l'API interne pour servir l'image
        generatedImageBuffer = await generateImageWithWavespeed(
          `/api/images/generated/${generatedPhoto1.id}`,
          prompts[i],
          settings.aspectRatio || '9:16',
          'png'
        )
      } else {
        // Pour Gemini, on utilise le base64 de l'image generee 1
        generatedImageBuffer = await generateImageWithGeminiWithRetry(
          image1Base64, // IMAGE 1, pas la reference!
          prompts[i],
          imageConfig,
          3,
          5000
        )
      }

      // Supprimer les metadonnees EXIF
      const cleanImageData = await removeExifFromBuffer(generatedImageBuffer)
      const imageBase64 = `data:image/jpeg;base64,${cleanImageData.toString('base64')}`

      // Creer l'entree GeneratedPhoto
      const generatedPhoto = await prisma.generatedPhoto.create({
        data: {
          sourcePhotoId: photos[i].id,
          prompt: prompts[i],
          localPath: `/api/images/generated/`,
          imageData: imageBase64,
          isCarousel: true,
          carouselId,
          carouselIndex: i,
          carouselTotal,
        }
      })

      // Mettre a jour localPath avec l'ID reel
      await prisma.generatedPhoto.update({
        where: { id: generatedPhoto.id },
        data: { localPath: `/api/images/generated/${generatedPhoto.id}` }
      })

      generatedPhotos.push(generatedPhoto)
      console.log(`Carousel: GeneratedPhoto ${i + 1} created with id ${generatedPhoto.id}`)
    }

    console.log(`Carousel: All ${generatedPhotos.length} images generated successfully`)

    // 11. Retourner le resultat
    return NextResponse.json({
      success: true,
      message: `Carrousel de ${photos.length} photos valide et genere avec succes`,
      provider,
      carouselId,
      photos: photos.map((p, i) => ({
        id: p.id,
        status: 'approved',
        generatedPrompt: prompts[i],
        carouselIndex: i,
      })),
      generatedPhotos: generatedPhotos.map((gp, i) => ({
        id: gp.id,
        localPath: `/api/images/generated/${gp.id}`,
        prompt: prompts[i],
        carouselIndex: i,
        createdAt: gp.createdAt.toISOString(),
      }))
    })

  } catch (error) {
    console.error('Error in carousel approve + generate workflow:', error)

    // Gerer les erreurs Google AI
    if (error instanceof GoogleAIError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'RATE_LIMIT': 429,
        'INVALID_IMAGE': 400,
        'CONTENT_BLOCKED': 400,
        'TIMEOUT': 504,
        'CONNECTION_ERROR': 502,
        'GENERATION_FAILED': 500,
        'UNKNOWN': 500,
      }

      let errorMessage = error.message
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        errorMessage += '. Conseil: basculez sur Wavespeed dans Settings si le probleme persiste.'
      }

      return NextResponse.json(
        { error: errorMessage, code: error.code, provider: 'gemini' },
        { status: statusCodes[error.code] || 500 }
      )
    }

    // Gerer les erreurs Wavespeed
    if (error instanceof WavespeedError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'NOT_DEPLOYED': 503,
        'RATE_LIMIT': 429,
        'API_ERROR': 502,
        'TIMEOUT': 504,
        'GENERATION_FAILED': 500,
        'NO_OUTPUT': 500,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code, provider: 'wavespeed' },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors du traitement du carrousel' },
      { status: 500 }
    )
  }
}
