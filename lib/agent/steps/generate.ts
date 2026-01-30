/**
 * Step 4 : Generate
 * Génère les images pour les photos approuvées qui ont un prompt
 */

import prisma from '@/lib/prisma'
import {
  generateImageWithGeminiWithRetry,
  isGoogleAIConfigured,
  ImageGenerationConfig
} from '@/lib/google-ai'
import { generateImageWithWavespeed, isWavespeedConfigured } from '@/lib/wavespeed'
import { removeExifFromBuffer } from '@/lib/exif-remover'
import { PipelineContext, StepResult } from '../types'

export async function executeGenerateStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId, settings } = context

  // Récupérer l'influenceuse avec sa photo de référence
  const influencer = await prisma.influencer.findUnique({
    where: { id: influencerId },
    select: { referencePhotoData: true }
  })

  if (!influencer?.referencePhotoData) {
    return {
      success: false,
      error: 'Photo de référence non configurée pour cette influenceuse'
    }
  }

  // Extraire le base64 pur de la photo de référence
  let referenceBase64 = influencer.referencePhotoData
  if (referenceBase64.startsWith('data:')) {
    const matches = referenceBase64.match(/^data:[^;]+;base64,(.+)$/)
    if (matches) {
      referenceBase64 = matches[1]
    }
  }

  // Récupérer les photos avec prompt mais sans image générée
  const photosToGenerate = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'approved',
      generatedPrompt: { not: null },
      generatedPhotos: { none: {} }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (photosToGenerate.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune photo à générer'
    }
  }

  // Déterminer le provider
  const provider = settings?.imageProvider || 'gemini'
  const aspectRatio = (settings?.imageAspectRatio || '9:16') as '9:16' | '1:1' | '16:9'
  const imageSize = (settings?.imageSize || '2K') as '1K' | '2K' | '4K'

  // Vérifier que le provider est configuré
  if (provider === 'gemini' && !await isGoogleAIConfigured()) {
    return {
      success: false,
      error: 'Google AI API non configurée'
    }
  }

  if (provider === 'wavespeed' && !await isWavespeedConfigured()) {
    return {
      success: false,
      error: 'Wavespeed API non configurée ou app non déployée'
    }
  }

  let generated = 0
  const errors: string[] = []

  for (const photo of photosToGenerate) {
    try {
      console.log(`[Generate] Génération pour la photo ${photo.id} avec ${provider}...`)

      let imageBuffer: Buffer

      if (provider === 'gemini') {
        const config: ImageGenerationConfig = {
          aspectRatio,
          imageSize
        }

        imageBuffer = await generateImageWithGeminiWithRetry(
          referenceBase64,
          photo.generatedPrompt!,
          config
        )
      } else {
        imageBuffer = await generateImageWithWavespeed(
          referenceBase64,
          photo.generatedPrompt!
        )
      }

      // Supprimer les métadonnées EXIF
      const cleanBuffer = await removeExifFromBuffer(imageBuffer)
      const cleanBase64 = cleanBuffer.toString('base64')

      // Sauvegarder l'image générée
      await prisma.generatedPhoto.create({
        data: {
          sourcePhotoId: photo.id,
          prompt: photo.generatedPrompt!,
          imageData: `data:image/jpeg;base64,${cleanBase64}`,
          isCarousel: photo.isCarousel,
          carouselId: photo.carouselId,
          carouselIndex: photo.carouselIndex,
          carouselTotal: photo.carouselTotal
        }
      })

      generated++
      console.log(`[Generate] Photo ${photo.id} générée avec succès`)
    } catch (error) {
      const errorMsg = `Photo ${photo.id}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      console.error(`[Generate] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  // Mettre à jour le contexte
  const generatedPhotos = await prisma.generatedPhoto.findMany({
    where: {
      sourcePhoto: {
        source: { influencerId }
      }
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: generated
  })

  context.generatedPhotoIds = generatedPhotos.map(p => p.id)

  if (generated === 0 && errors.length > 0) {
    return {
      success: false,
      error: `Toutes les générations ont échoué: ${errors.join('; ')}`
    }
  }

  return {
    success: true,
    data: {
      photosGenerated: generated,
      provider,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}
