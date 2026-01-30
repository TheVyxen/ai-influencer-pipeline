/**
 * Step 6 : Schedule
 * Programme les posts Instagram avec les horaires optimaux
 */

import prisma from '@/lib/prisma'
import { PipelineContext, StepResult } from '../types'
import { findNextSlot } from '../ai/scheduling'

export async function executeScheduleStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId, captionedPhotoIds = [], captions } = context

  if (captionedPhotoIds.length === 0 || !captions || captions.size === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune photo avec caption à programmer'
    }
  }

  // Récupérer les photos générées avec leurs captions
  const generatedPhotos = await prisma.generatedPhoto.findMany({
    where: {
      id: { in: captionedPhotoIds }
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

  console.log(`[Schedule] Scheduling ${generatedPhotos.length} posts`)

  const scheduledPostIds: string[] = []
  const errors: string[] = []

  for (const photo of generatedPhotos) {
    try {
      const captionData = captions.get(photo.id)

      if (!captionData) {
        console.log(`[Schedule] No caption for photo ${photo.id}`)
        errors.push(photo.id)
        continue
      }

      if (!photo.imageData) {
        console.log(`[Schedule] No image data for photo ${photo.id}`)
        errors.push(photo.id)
        continue
      }

      // Trouver le prochain créneau disponible
      const slot = await findNextSlot(influencerId)

      console.log(`[Schedule] Scheduling photo ${photo.id} for ${slot.scheduledFor.toISOString()}`)

      // Créer le post programmé
      const scheduledPost = await prisma.scheduledPost.create({
        data: {
          influencerId,
          generatedPhotoId: photo.id,
          imageData: photo.imageData,
          caption: captionData.caption,
          hashtags: captionData.hashtags,
          isCarousel: photo.isCarousel,
          carouselImages: [],
          scheduledFor: slot.scheduledFor,
          status: 'scheduled'
        }
      })

      scheduledPostIds.push(scheduledPost.id)

      // Petit délai
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`[Schedule] Error scheduling photo ${photo.id}:`, error)
      errors.push(photo.id)
    }
  }

  context.scheduledPostIds = scheduledPostIds

  if (scheduledPostIds.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucun post programmé (erreurs ou données manquantes)'
    }
  }

  return {
    success: true,
    data: {
      postsScheduled: scheduledPostIds.length,
      errors: errors.length
    }
  }
}
