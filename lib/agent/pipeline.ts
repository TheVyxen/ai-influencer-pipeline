/**
 * Orchestrateur de pipeline
 * Exécute les étapes séquentiellement, gère les erreurs et le tracking
 */

import prisma from '@/lib/prisma'
import {
  PipelineContext,
  PipelineStepName,
  PIPELINE_STEPS,
  StepResult,
  TriggerType
} from './types'

// Import des handlers de steps
import { executeScrapeStep } from './steps/scrape'
import { executeValidateStep } from './steps/validate'
import { executeDescribeStep } from './steps/describe'
import { executeGenerateStep } from './steps/generate'
import { executeCaptionStep } from './steps/caption'
import { executeScheduleStep } from './steps/schedule'

// Map des handlers par nom de step
const STEP_HANDLERS: Record<PipelineStepName, (ctx: PipelineContext) => Promise<StepResult>> = {
  scrape: executeScrapeStep,
  validate: executeValidateStep,
  describe: executeDescribeStep,
  generate: executeGenerateStep,
  caption: executeCaptionStep,
  schedule: executeScheduleStep
}

/**
 * Crée un nouveau pipeline run et ses steps
 */
export async function createPipelineRun(
  influencerId: string,
  trigger: TriggerType
): Promise<string> {
  // Vérifier qu'il n'y a pas déjà un pipeline en cours pour cette influenceuse
  const existingRun = await prisma.pipelineRun.findFirst({
    where: {
      influencerId,
      status: { in: ['pending', 'running'] }
    }
  })

  if (existingRun) {
    throw new Error(`Un pipeline est déjà en cours (ID: ${existingRun.id})`)
  }

  // Créer le pipeline run avec tous ses steps
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      influencerId,
      trigger,
      status: 'pending',
      steps: {
        create: PIPELINE_STEPS.map(step => ({
          step,
          status: 'pending'
        }))
      }
    }
  })

  return pipelineRun.id
}

/**
 * Exécute un pipeline complet
 */
export async function executePipeline(pipelineRunId: string): Promise<void> {
  // Récupérer le pipeline run avec ses steps
  const pipelineRun = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    include: {
      steps: { orderBy: { id: 'asc' } },
      influencer: {
        include: { settings: true }
      }
    }
  })

  if (!pipelineRun) {
    throw new Error(`Pipeline run non trouvé: ${pipelineRunId}`)
  }

  if (pipelineRun.status !== 'pending') {
    throw new Error(`Pipeline run n'est pas en attente: ${pipelineRun.status}`)
  }

  // Marquer le pipeline comme en cours
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'running',
      startedAt: new Date()
    }
  })

  // Préparer le contexte
  const context: PipelineContext = {
    influencerId: pipelineRun.influencerId,
    pipelineRunId,
    settings: pipelineRun.influencer.settings ? {
      imageProvider: pipelineRun.influencer.settings.imageProvider,
      imageAspectRatio: pipelineRun.influencer.settings.imageAspectRatio,
      imageSize: pipelineRun.influencer.settings.imageSize,
      postsPerScrape: pipelineRun.influencer.settings.postsPerScrape
    } : undefined
  }

  // Exécuter chaque step séquentiellement
  for (const stepRecord of pipelineRun.steps) {
    const stepName = stepRecord.step as PipelineStepName
    const handler = STEP_HANDLERS[stepName]

    if (!handler) {
      console.warn(`Handler non trouvé pour le step: ${stepName}`)
      continue
    }

    // Mettre à jour le currentStep du pipeline
    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: { currentStep: stepName }
    })

    // Marquer le step comme en cours
    await prisma.pipelineStep.update({
      where: { id: stepRecord.id },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    })

    try {
      console.log(`[Pipeline ${pipelineRunId}] Exécution du step: ${stepName}`)
      const result = await handler(context)

      if (result.skipped) {
        // Step sauté
        await prisma.pipelineStep.update({
          where: { id: stepRecord.id },
          data: {
            status: 'skipped',
            output: result.data as object || null,
            errorMessage: result.skipReason,
            completedAt: new Date()
          }
        })
        console.log(`[Pipeline ${pipelineRunId}] Step ${stepName} sauté: ${result.skipReason}`)
      } else if (result.success) {
        // Step réussi
        await prisma.pipelineStep.update({
          where: { id: stepRecord.id },
          data: {
            status: 'completed',
            output: result.data as object || null,
            completedAt: new Date()
          }
        })

        // Mettre à jour les compteurs du pipeline
        await updatePipelineCounters(pipelineRunId, stepName, result.data)

        console.log(`[Pipeline ${pipelineRunId}] Step ${stepName} terminé avec succès`)
      } else {
        // Step échoué
        throw new Error(result.error || 'Erreur inconnue')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'

      // Marquer le step comme échoué
      await prisma.pipelineStep.update({
        where: { id: stepRecord.id },
        data: {
          status: 'failed',
          errorMessage,
          completedAt: new Date()
        }
      })

      // Marquer le pipeline comme échoué
      await prisma.pipelineRun.update({
        where: { id: pipelineRunId },
        data: {
          status: 'failed',
          errorStep: stepName,
          errorMessage,
          completedAt: new Date()
        }
      })

      console.error(`[Pipeline ${pipelineRunId}] Step ${stepName} échoué:`, errorMessage)
      return // Arrêter l'exécution
    }
  }

  // Tous les steps ont réussi, marquer le pipeline comme terminé
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'completed',
      currentStep: null,
      completedAt: new Date()
    }
  })

  // Mettre à jour le timestamp du dernier run de l'influenceuse
  await prisma.influencer.update({
    where: { id: pipelineRun.influencerId },
    data: { lastAgentRun: new Date() }
  })

  console.log(`[Pipeline ${pipelineRunId}] Pipeline terminé avec succès`)
}

/**
 * Met à jour les compteurs du pipeline en fonction du step terminé
 */
async function updatePipelineCounters(
  pipelineRunId: string,
  stepName: PipelineStepName,
  data?: Record<string, unknown>
): Promise<void> {
  const updates: Record<string, number> = {}

  switch (stepName) {
    case 'scrape':
      if (typeof data?.photosScraped === 'number') {
        updates.photosScraped = data.photosScraped
      }
      break
    case 'validate':
      if (typeof data?.photosValidated === 'number') {
        updates.photosValidated = data.photosValidated
      }
      break
    case 'generate':
      if (typeof data?.photosGenerated === 'number') {
        updates.photosGenerated = data.photosGenerated
      }
      break
    case 'schedule':
      if (typeof data?.postsScheduled === 'number') {
        updates.postsScheduled = data.postsScheduled
      }
      break
  }

  if (Object.keys(updates).length > 0) {
    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: updates
    })
  }
}

/**
 * Annule un pipeline en cours
 */
export async function cancelPipeline(pipelineRunId: string): Promise<void> {
  const pipelineRun = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId }
  })

  if (!pipelineRun) {
    throw new Error(`Pipeline run non trouvé: ${pipelineRunId}`)
  }

  if (!['pending', 'running'].includes(pipelineRun.status)) {
    throw new Error(`Pipeline ne peut pas être annulé (status: ${pipelineRun.status})`)
  }

  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'cancelled',
      completedAt: new Date()
    }
  })
}

/**
 * Récupère le statut actuel d'un pipeline
 */
export async function getPipelineStatus(pipelineRunId: string) {
  return prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    include: {
      steps: { orderBy: { id: 'asc' } },
      influencer: {
        select: { id: true, name: true, handle: true }
      }
    }
  })
}

/**
 * Récupère le dernier pipeline run d'une influenceuse
 */
export async function getLatestPipelineRun(influencerId: string) {
  return prisma.pipelineRun.findFirst({
    where: { influencerId },
    orderBy: { createdAt: 'desc' },
    include: {
      steps: { orderBy: { id: 'asc' } }
    }
  })
}
