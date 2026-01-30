/**
 * Step 5 : Caption
 * Génère des captions Instagram pour les photos générées
 */

import prisma from '@/lib/prisma'
import { PipelineContext, StepResult } from '../types'
import { generateCaption } from '../ai/captions'

export async function executeCaptionStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId, generatedPhotoIds = [] } = context

  // Chercher les photos générées qui n'ont pas encore de post programmé
  let photosToProcess = generatedPhotoIds

  if (photosToProcess.length === 0) {
    const photosWithoutSchedule = await prisma.generatedPhoto.findMany({
      where: {
        sourcePhoto: {
          source: { influencerId }
        },
        scheduledPosts: {
          none: {}
        }
      },
      select: { id: true },
      take: 10
    })

    photosToProcess = photosWithoutSchedule.map(p => p.id)
  }

  if (photosToProcess.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune photo générée en attente de caption'
    }
  }

  // Récupérer les photos générées avec leurs détails
  const generatedPhotos = await prisma.generatedPhoto.findMany({
    where: {
      id: { in: photosToProcess }
    },
    include: {
      sourcePhoto: true
    }
  })

  if (generatedPhotos.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune photo générée trouvée'
    }
  }

  // Vérifier la clé API
  const apiKey = await prisma.appSettings.findUnique({
    where: { key: 'google_ai_api_key' }
  })

  if (!apiKey?.value) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Clé API Google AI non configurée'
    }
  }

  console.log(`[Caption] Generating captions for ${generatedPhotos.length} photos`)

  const captionedPhotoIds: string[] = []
  const captions: Map<string, { caption: string; hashtags: string[] }> = new Map()
  const errors: string[] = []

  for (const photo of generatedPhotos) {
    try {
      // Utiliser l'image générée
      const imageBase64 = photo.imageData

      if (!imageBase64) {
        console.log(`[Caption] No image data for photo ${photo.id}`)
        errors.push(photo.id)
        continue
      }

      // Générer la caption
      const result = await generateCaption(
        imageBase64,
        photo.sourcePhoto.generatedPrompt || photo.prompt || 'Photo lifestyle',
        influencerId
      )

      console.log(`[Caption] Generated caption for photo ${photo.id}:`, result.caption.substring(0, 50) + '...')

      captions.set(photo.id, result)
      captionedPhotoIds.push(photo.id)

      // Délai pour éviter le rate limit
      await new Promise(resolve => setTimeout(resolve, 1500))
    } catch (error) {
      console.error(`[Caption] Error generating caption for photo ${photo.id}:`, error)
      errors.push(photo.id)
    }
  }

  // Stocker dans le contexte pour le step schedule
  context.captionedPhotoIds = captionedPhotoIds
  context.captions = captions

  if (captionedPhotoIds.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune caption générée (erreurs ou pas d\'images)'
    }
  }

  return {
    success: true,
    data: {
      captionsGenerated: captionedPhotoIds.length,
      errors: errors.length
    }
  }
}
