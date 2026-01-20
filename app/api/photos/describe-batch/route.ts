import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { describePhoto, describeCarouselPhotos, GoogleAIError } from '@/lib/google-ai'

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
 * POST /api/photos/describe-batch
 * Décrit plusieurs photos en lot
 * - Regroupe les photos par carouselId
 * - Pour les carrousels : utilise describeCarouselPhotos (image 1 = complète, images 2+ = pose only)
 * - Pour les photos individuelles : utilise describePhoto
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photoIds } = body as { photoIds: string[] }

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: 'photoIds est requis et doit être un tableau non vide' },
        { status: 400 }
      )
    }

    // Récupérer toutes les photos
    const photos = await prisma.sourcePhoto.findMany({
      where: { id: { in: photoIds } },
      orderBy: { carouselIndex: 'asc' }
    })

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Aucune photo trouvée' },
        { status: 404 }
      )
    }

    // Regrouper les photos par carouselId
    const carouselGroups = new Map<string, typeof photos>()
    const singlePhotos: typeof photos = []

    for (const photo of photos) {
      if (photo.isCarousel && photo.carouselId) {
        const existing = carouselGroups.get(photo.carouselId) || []
        existing.push(photo)
        carouselGroups.set(photo.carouselId, existing)
      } else {
        singlePhotos.push(photo)
      }
    }

    const results: { id: string; prompt: string; success: boolean; error?: string }[] = []

    // Traiter les carrousels avec describeCarouselPhotos
    for (const [carouselId, carouselPhotos] of carouselGroups) {
      console.log(`Processing carousel ${carouselId} with ${carouselPhotos.length} photos`)

      // Trier par carouselIndex
      carouselPhotos.sort((a, b) => (a.carouselIndex || 0) - (b.carouselIndex || 0))

      try {
        // Télécharger toutes les images du carrousel
        const imageBuffers: Buffer[] = []
        for (const photo of carouselPhotos) {
          if (!photo.originalUrl) {
            throw new Error(`Photo ${photo.id} n'a pas d'URL source`)
          }
          const buffer = await downloadImageFromUrl(photo.originalUrl)
          imageBuffers.push(buffer)
        }

        // Générer les prompts avec describeCarouselPhotos
        // Image 1 = description complète, Images 2+ = pose only
        const prompts = await describeCarouselPhotos(imageBuffers)

        // Sauvegarder les prompts
        for (let i = 0; i < carouselPhotos.length; i++) {
          const photo = carouselPhotos[i]
          const prompt = prompts[i] || prompts[0] // Fallback au premier prompt si pas assez

          await prisma.sourcePhoto.update({
            where: { id: photo.id },
            data: { generatedPrompt: prompt }
          })

          results.push({ id: photo.id, prompt, success: true })
        }

        console.log(`Carousel ${carouselId}: ${prompts.length} prompts generated`)

      } catch (error) {
        console.error(`Error processing carousel ${carouselId}:`, error)
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'

        for (const photo of carouselPhotos) {
          results.push({ id: photo.id, prompt: '', success: false, error: errorMsg })
        }
      }
    }

    // Traiter les photos individuelles avec describePhoto
    for (const photo of singlePhotos) {
      console.log(`Processing single photo ${photo.id}`)

      try {
        if (!photo.originalUrl) {
          throw new Error('Photo URL not found')
        }

        const imageBuffer = await downloadImageFromUrl(photo.originalUrl)
        const prompt = await describePhoto(imageBuffer, 'image/jpeg')

        await prisma.sourcePhoto.update({
          where: { id: photo.id },
          data: { generatedPrompt: prompt }
        })

        results.push({ id: photo.id, prompt, success: true })

      } catch (error) {
        console.error(`Error describing photo ${photo.id}:`, error)
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
        results.push({ id: photo.id, prompt: '', success: false, error: errorMsg })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `${successCount} photo(s) décrite(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
      results
    })

  } catch (error) {
    console.error('Error in batch describe:', error)

    if (error instanceof GoogleAIError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'RATE_LIMIT': 429,
        'INVALID_IMAGE': 400,
        'CONTENT_BLOCKED': 400,
        'CONNECTION_ERROR': 502,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors de la description des photos' },
      { status: 500 }
    )
  }
}
