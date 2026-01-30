/**
 * Worker background pour exécuter les jobs de pipeline
 * Ce worker poll la table Job et exécute les pipelines en attente
 *
 * Usage: npx tsx scripts/start-worker.ts
 */

import prisma from '@/lib/prisma'
import { executePipeline } from './pipeline'

// Configuration du worker
const POLL_INTERVAL_MS = 5000 // 5 secondes entre chaque poll
const MAX_CONCURRENT_JOBS = 1 // Nombre max de jobs en parallèle

let isRunning = false
let currentJobs = 0

/**
 * Démarre le worker
 */
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Already running')
    return
  }

  isRunning = true
  console.log('[Worker] Started')
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`)
  console.log(`[Worker] Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`)

  while (isRunning) {
    try {
      await processNextJob()
    } catch (error) {
      console.error('[Worker] Error processing job:', error)
    }

    // Attendre avant le prochain poll
    await sleep(POLL_INTERVAL_MS)
  }

  console.log('[Worker] Stopped')
}

/**
 * Arrête le worker
 */
export function stopWorker(): void {
  console.log('[Worker] Stopping...')
  isRunning = false
}

/**
 * Traite le prochain job en attente
 */
async function processNextJob(): Promise<void> {
  // Vérifier si on peut prendre un nouveau job
  if (currentJobs >= MAX_CONCURRENT_JOBS) {
    return
  }

  // Récupérer le prochain job en attente
  const job = await prisma.job.findFirst({
    where: {
      status: 'pending',
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  })

  if (!job) {
    return
  }

  // Marquer le job comme en cours
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'processing',
      startedAt: new Date(),
      attempts: job.attempts + 1
    }
  })

  currentJobs++
  console.log(`[Worker] Processing job ${job.id} (type: ${job.type})`)

  try {
    await executeJob(job)

    // Marquer le job comme terminé
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    })

    console.log(`[Worker] Job ${job.id} completed`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Vérifier si on peut réessayer
    if (job.attempts < job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          lastError: errorMessage
        }
      })
      console.log(`[Worker] Job ${job.id} failed, will retry (${job.attempts + 1}/${job.maxAttempts})`)
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          lastError: errorMessage,
          completedAt: new Date()
        }
      })
      console.log(`[Worker] Job ${job.id} failed permanently: ${errorMessage}`)
    }
  } finally {
    currentJobs--
  }
}

/**
 * Exécute un job selon son type
 */
async function executeJob(job: { id: string; type: string; data: unknown }): Promise<void> {
  const data = job.data as Record<string, unknown>

  switch (job.type) {
    case 'pipeline':
      if (typeof data.pipelineRunId !== 'string') {
        throw new Error('pipelineRunId manquant dans les données du job')
      }
      await executePipeline(data.pipelineRunId)
      break

    default:
      throw new Error(`Type de job inconnu: ${job.type}`)
  }
}

/**
 * Crée un job pour exécuter un pipeline
 */
export async function createPipelineJob(
  pipelineRunId: string,
  priority: number = 0
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type: 'pipeline',
      priority,
      data: { pipelineRunId }
    }
  })

  return job.id
}

/**
 * Utilitaire pour dormir
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
