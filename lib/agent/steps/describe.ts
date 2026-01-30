/**
 * Step 3 : Describe
 * Génère les prompts pour les photos approuvées qui n'ont pas encore de prompt
 */

import prisma from '@/lib/prisma'
import { describePhoto, isGoogleAIConfigured } from '@/lib/google-ai'
import { PipelineContext, StepResult } from '../types'

export async function executeDescribeStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId } = context

  // Vérifier que Google AI est configuré
  if (!await isGoogleAIConfigured()) {
    return {
      success: false,
      error: 'Google AI API non configurée'
    }
  }

  // Récupérer les photos approuvées sans prompt
  const photosToDescribe = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'approved',
      generatedPrompt: null
    },
    orderBy: { createdAt: 'asc' }
  })

  if (photosToDescribe.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune photo à décrire'
    }
  }

  let described = 0
  const errors: string[] = []

  for (const photo of photosToDescribe) {
    try {
      console.log(`[Describe] Description de la photo ${photo.id}...`)

      // Télécharger l'image
      const response = await fetch(photo.originalUrl)
      if (!response.ok) {
        throw new Error(`Impossible de télécharger l'image: ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const mimeType = response.headers.get('content-type') || 'image/jpeg'

      // Générer le prompt avec Gemini
      const prompt = await describePhoto(buffer, mimeType)

      // Sauvegarder le prompt
      await prisma.sourcePhoto.update({
        where: { id: photo.id },
        data: { generatedPrompt: prompt }
      })

      described++
      console.log(`[Describe] Photo ${photo.id} décrite avec succès`)
    } catch (error) {
      const errorMsg = `Photo ${photo.id}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      console.error(`[Describe] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  // Mettre à jour le contexte
  const describedPhotos = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'approved',
      generatedPrompt: { not: null }
    },
    select: { id: true }
  })

  context.describedPhotoIds = describedPhotos.map(p => p.id)

  if (described === 0 && errors.length > 0) {
    return {
      success: false,
      error: `Toutes les descriptions ont échoué: ${errors.join('; ')}`
    }
  }

  return {
    success: true,
    data: {
      photosDescribed: described,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}
