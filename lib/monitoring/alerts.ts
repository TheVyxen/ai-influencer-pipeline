/**
 * Service de gestion des alertes
 * Créer, récupérer et gérer les alertes système
 */

import prisma from '@/lib/prisma'

export type AlertType = 'error' | 'warning' | 'info'
export type AlertCategory =
  | 'pipeline_failed'
  | 'token_expired'
  | 'rate_limit'
  | 'budget_exceeded'
  | 'generation_failed'
  | 'publish_failed'
  | 'scrape_failed'
  | 'system'

export interface CreateAlertInput {
  type: AlertType
  category: AlertCategory
  title: string
  message: string
  influencerId?: string
}

/**
 * Crée une nouvelle alerte
 */
export async function createAlert(input: CreateAlertInput): Promise<void> {
  await prisma.alert.create({
    data: {
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      influencerId: input.influencerId
    }
  })

  console.log(`[Alert] ${input.type.toUpperCase()}: ${input.title}`)
}

/**
 * Récupère les alertes non lues
 */
export async function getUnreadAlerts(influencerId?: string): Promise<Array<{
  id: string
  type: string
  category: string
  title: string
  message: string
  createdAt: Date
  influencer?: { name: string; handle: string } | null
}>> {
  const where: Record<string, unknown> = {
    isRead: false,
    isResolved: false
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  return prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      influencer: {
        select: {
          name: true,
          handle: true
        }
      }
    }
  })
}

/**
 * Récupère toutes les alertes récentes
 */
export async function getRecentAlerts(
  days: number = 7,
  influencerId?: string
): Promise<Array<{
  id: string
  type: string
  category: string
  title: string
  message: string
  isRead: boolean
  isResolved: boolean
  createdAt: Date
}>> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const where: Record<string, unknown> = {
    createdAt: {
      gte: startDate
    }
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  return prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100
  })
}

/**
 * Marque une alerte comme lue
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: { isRead: true }
  })
}

/**
 * Marque une alerte comme résolue
 */
export async function resolveAlert(alertId: string): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: { isResolved: true, isRead: true }
  })
}

/**
 * Marque toutes les alertes comme lues
 */
export async function markAllAlertsAsRead(influencerId?: string): Promise<number> {
  const where: Record<string, unknown> = {
    isRead: false
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  const result = await prisma.alert.updateMany({
    where,
    data: { isRead: true }
  })

  return result.count
}

/**
 * Supprime les anciennes alertes résolues
 */
export async function cleanupOldAlerts(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const result = await prisma.alert.deleteMany({
    where: {
      isResolved: true,
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  return result.count
}

/**
 * Vérifie et crée des alertes automatiques après un pipeline
 */
export async function checkAndCreateAlerts(
  influencerId: string,
  pipelineRunId: string
): Promise<void> {
  // Récupérer le run
  const run = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    include: {
      influencer: true
    }
  })

  if (!run) return

  // Alerte si le pipeline a échoué
  if (run.status === 'failed') {
    await createAlert({
      type: 'error',
      category: 'pipeline_failed',
      title: `Pipeline échoué pour ${run.influencer.name}`,
      message: run.errorMessage || `Erreur au step ${run.errorStep}`,
      influencerId
    })
  }

  // Vérifier le token Instagram
  const instagramAccount = await prisma.instagramAccount.findUnique({
    where: { influencerId }
  })

  if (instagramAccount) {
    const daysUntilExpiry = Math.floor(
      (instagramAccount.accessTokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
      // Vérifier si on n'a pas déjà créé cette alerte récemment
      const existingAlert = await prisma.alert.findFirst({
        where: {
          influencerId,
          category: 'token_expired',
          isResolved: false,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })

      if (!existingAlert) {
        await createAlert({
          type: 'warning',
          category: 'token_expired',
          title: `Token Instagram expire bientôt`,
          message: `Le token de ${run.influencer.name} expire dans ${daysUntilExpiry} jours. Reconnectez le compte.`,
          influencerId
        })
      }
    }
  }
}
