import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { describePhoto, generateImageWithGeminiWithRetry, GoogleAIError, ImageGenerationConfig } from '@/lib/google-ai'
import { generateImageWithWavespeed, WavespeedError } from '@/lib/wavespeed'
import { removeExifFromBuffer } from '@/lib/exif-remover'

/**
 * Télécharge une image depuis une URL et retourne le buffer
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
 * Récupère la photo de référence depuis la base de données (base64)
 * Retourne le base64 pur (sans le préfixe data:...)
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
 * Récupère la configuration de génération depuis les Settings
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
    // Valeurs par défaut en cas d'erreur
    return { provider: 'gemini', aspectRatio: '9:16', imageSize: '2K' }
  }
}

/**
 * PATCH /api/photos/[id]/approve
 * Workflow complet : Approuver → Décrire → Générer
 * Retourne directement la photo générée
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 1. Vérifier que la photo existe
    const photo = await prisma.sourcePhoto.findUnique({
      where: { id }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Vérifier qu'on a une URL originale pour la description
    if (!photo.originalUrl) {
      return NextResponse.json(
        { error: 'Photo URL not found' },
        { status: 400 }
      )
    }

    // 2. Vérifier la photo de référence
    const referenceBase64 = await getReferencePhotoBase64()

    if (!referenceBase64) {
      return NextResponse.json(
        { error: 'Configurez d\'abord votre photo de référence dans Settings' },
        { status: 400 }
      )
    }

    // 3. Approuver la photo
    await prisma.sourcePhoto.update({
      where: { id },
      data: { status: 'approved' }
    })

    // 4. Télécharger l'image source et générer le prompt
    let imageBuffer: Buffer
    try {
      imageBuffer = await downloadImageFromUrl(photo.originalUrl)
    } catch (error) {
      console.error('Error downloading image from URL:', error)
      return NextResponse.json(
        { error: 'Impossible de télécharger l\'image source' },
        { status: 500 }
      )
    }

    // Déterminer le type MIME
    const url = photo.originalUrl.toLowerCase()
    let mimeType = 'image/jpeg'
    if (url.includes('.png')) {
      mimeType = 'image/png'
    } else if (url.includes('.webp')) {
      mimeType = 'image/webp'
    }

    // Générer le prompt via Gemini
    const generatedPrompt = await describePhoto(imageBuffer, mimeType)

    // Sauvegarder le prompt
    await prisma.sourcePhoto.update({
      where: { id },
      data: { generatedPrompt }
    })

    // 5. Récupérer les settings de génération
    const settings = await getGenerationSettings()
    const provider = settings.provider

    console.log(`Starting generation with provider: ${provider}`)

    // 6. Générer l'image
    let generatedImageBuffer: Buffer

    if (provider === 'wavespeed') {
      // Génération via Wavespeed
      generatedImageBuffer = await generateImageWithWavespeed(
        '/api/images/reference',
        generatedPrompt,
        settings.aspectRatio || '9:16',
        'png'
      )
    } else {
      // Génération via Gemini avec retry automatique
      const imageConfig: ImageGenerationConfig = {
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize,
      }
      generatedImageBuffer = await generateImageWithGeminiWithRetry(
        referenceBase64,
        generatedPrompt,
        imageConfig,
        3,    // maxRetries
        5000  // delayMs
      )
    }

    // 7. Supprimer les métadonnées EXIF
    const cleanImageData = await removeExifFromBuffer(generatedImageBuffer)

    // 8. Convertir en base64 pour stockage
    const imageBase64 = `data:image/jpeg;base64,${cleanImageData.toString('base64')}`

    // 9. Créer l'entrée GeneratedPhoto
    const generatedPhoto = await prisma.generatedPhoto.create({
      data: {
        sourcePhotoId: photo.id,
        prompt: generatedPrompt,
        localPath: `/api/images/generated/`,
        imageData: imageBase64,
      }
    })

    // Mettre à jour localPath avec l'ID réel
    await prisma.generatedPhoto.update({
      where: { id: generatedPhoto.id },
      data: { localPath: `/api/images/generated/${generatedPhoto.id}` }
    })

    return NextResponse.json({
      success: true,
      message: 'Photo validée et générée avec succès',
      provider: provider,
      photo: {
        id: photo.id,
        status: 'approved',
        generatedPrompt: generatedPrompt
      },
      generatedPhoto: {
        id: generatedPhoto.id,
        localPath: `/api/images/generated/${generatedPhoto.id}`,
        prompt: generatedPrompt,
        createdAt: generatedPhoto.createdAt.toISOString(),
      }
    })
  } catch (error) {
    console.error('Error in approve + generate workflow:', error)

    // Gérer les erreurs Google AI
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
        errorMessage += '. Conseil: basculez sur Wavespeed dans Settings si le problème persiste.'
      }

      return NextResponse.json(
        { error: errorMessage, code: error.code, provider: 'gemini' },
        { status: statusCodes[error.code] || 500 }
      )
    }

    // Gérer les erreurs Wavespeed
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
      { error: 'Erreur lors du traitement' },
      { status: 500 }
    )
  }
}
