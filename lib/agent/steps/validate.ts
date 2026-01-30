/**
 * Step 2 : Validate
 * Utilise l'IA pour valider automatiquement les photos en attente
 * Les photos avec un score >= threshold sont auto-approuvées
 */

import prisma from '@/lib/prisma'
import { PipelineContext, StepResult } from '../types'
import { validatePhoto, ValidationResult } from '../ai/validation'

export async function executeValidateStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId } = context

  // Récupérer les settings pour savoir si l'auto-validation est activée
  const settings = await prisma.influencerSettings.findUnique({
    where: { influencerId }
  })

  // Récupérer les photos en attente de validation
  const pendingPhotos = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'pending'
    },
    select: {
      id: true,
      originalUrl: true,
      localPath: true
    },
    take: 20 // Limiter pour éviter les timeouts
  })

  if (pendingPhotos.length === 0) {
    // Compter les photos déjà approuvées
    const approvedPhotos = await prisma.sourcePhoto.findMany({
      where: {
        source: { influencerId },
        status: 'approved',
        generatedPrompt: null
      },
      select: { id: true }
    })

    context.validatedPhotoIds = approvedPhotos.map(p => p.id)

    if (approvedPhotos.length === 0) {
      return {
        success: true,
        skipped: true,
        skipReason: 'Aucune photo à valider'
      }
    }

    return {
      success: true,
      data: {
        photosValidated: approvedPhotos.length,
        note: 'Photos déjà approuvées manuellement'
      }
    }
  }

  // Vérifier si on a la clé API pour la validation IA
  const apiKey = await prisma.appSettings.findUnique({
    where: { key: 'google_ai_api_key' }
  })

  if (!apiKey?.value) {
    // Pas de clé API, on ne peut pas valider automatiquement
    return {
      success: true,
      skipped: true,
      skipReason: `${pendingPhotos.length} photo(s) en attente de validation manuelle (clé API non configurée)`
    }
  }

  const threshold = settings?.validationThreshold ?? 0.7
  console.log(`[Validate] Validating ${pendingPhotos.length} photos with threshold ${threshold}`)

  const approved: string[] = []
  const rejected: string[] = []
  const errors: string[] = []

  for (const photo of pendingPhotos) {
    try {
      // Récupérer l'image (depuis l'URL ou le fichier local)
      let imageBase64: string | null = null

      if (photo.localPath) {
        // Essayer de lire depuis le fichier local
        try {
          const fs = await import('fs')
          const path = await import('path')
          const fullPath = path.join(process.cwd(), 'public', photo.localPath)
          if (fs.existsSync(fullPath)) {
            const buffer = fs.readFileSync(fullPath)
            imageBase64 = buffer.toString('base64')
          }
        } catch {
          // Ignorer l'erreur, on essaiera l'URL
        }
      }

      if (!imageBase64 && photo.originalUrl) {
        // Télécharger depuis l'URL
        try {
          const response = await fetch(photo.originalUrl)
          if (response.ok) {
            const buffer = await response.arrayBuffer()
            imageBase64 = Buffer.from(buffer).toString('base64')
          }
        } catch {
          // Ignorer l'erreur
        }
      }

      if (!imageBase64) {
        console.log(`[Validate] Could not load image for photo ${photo.id}`)
        errors.push(photo.id)
        continue
      }

      // Valider avec l'IA
      const result: ValidationResult = await validatePhoto(imageBase64, influencerId)
      console.log(`[Validate] Photo ${photo.id}: score=${result.score}, approved=${result.approved}`)

      // Mettre à jour le statut
      await prisma.sourcePhoto.update({
        where: { id: photo.id },
        data: {
          status: result.approved ? 'approved' : 'rejected'
        }
      })

      if (result.approved) {
        approved.push(photo.id)
      } else {
        rejected.push(photo.id)
      }

      // Petit délai pour éviter le rate limit
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`[Validate] Error validating photo ${photo.id}:`, error)
      errors.push(photo.id)
    }
  }

  // Récupérer toutes les photos approuvées (y compris celles déjà approuvées manuellement)
  const allApproved = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'approved',
      generatedPrompt: null
    },
    select: { id: true }
  })

  context.validatedPhotoIds = allApproved.map(p => p.id)

  return {
    success: true,
    data: {
      processed: pendingPhotos.length,
      autoApproved: approved.length,
      autoRejected: rejected.length,
      errors: errors.length,
      totalApproved: allApproved.length,
      threshold
    }
  }
}
