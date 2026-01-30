/**
 * Service d'agrégation des métriques
 * Collecte et agrège les métriques pour le dashboard agent
 */

import prisma from '@/lib/prisma'

export interface PipelineMetrics {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  successRate: number
  averageDuration: number
  byStep: Record<string, { success: number; failed: number }>
}

export interface ContentMetrics {
  photosScraped: number
  photosApproved: number
  photosGenerated: number
  postsScheduled: number
  postsPublished: number
  approvalRate: number
}

export interface InfluencerMetrics {
  id: string
  name: string
  handle: string
  pipelineRuns: number
  lastRun: Date | null
  successRate: number
  photosGenerated: number
  postsPublished: number
}

/**
 * Récupère les métriques des pipelines pour une période donnée
 */
export async function getPipelineMetrics(
  period: '24h' | '7d' | '30d',
  influencerId?: string
): Promise<PipelineMetrics> {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  const where: Record<string, unknown> = {
    startedAt: {
      gte: startDate
    }
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  const runs = await prisma.pipelineRun.findMany({
    where
  })

  // Calculer les métriques
  const totalRuns = runs.length
  const successfulRuns = runs.filter(r => r.status === 'completed').length
  const failedRuns = runs.filter(r => r.status === 'failed').length

  // Durée moyenne (seulement les runs complétés avec startedAt)
  const completedRuns = runs.filter(r => r.completedAt && r.startedAt)
  const averageDuration = completedRuns.length > 0
    ? completedRuns.reduce((acc, r) => {
        const duration = r.completedAt!.getTime() - r.startedAt!.getTime()
        return acc + duration
      }, 0) / completedRuns.length / 1000 // en secondes
    : 0

  // Métriques par step
  const byStep: Record<string, { success: number; failed: number }> = {}
  for (const run of runs) {
    if (run.errorStep) {
      if (!byStep[run.errorStep]) {
        byStep[run.errorStep] = { success: 0, failed: 0 }
      }
      byStep[run.errorStep].failed++
    }
  }

  // Pour les runs réussis, compter chaque step comme succès
  const steps = ['scrape', 'validate', 'describe', 'generate', 'caption', 'schedule', 'publish']
  for (const step of steps) {
    if (!byStep[step]) {
      byStep[step] = { success: 0, failed: 0 }
    }
  }

  for (const run of successfulRuns ? runs.filter(r => r.status === 'completed') : []) {
    for (const step of steps) {
      byStep[step].success++
    }
  }

  return {
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 100,
    averageDuration: Math.round(averageDuration),
    byStep
  }
}

/**
 * Récupère les métriques de contenu
 */
export async function getContentMetrics(
  period: '24h' | '7d' | '30d',
  influencerId?: string
): Promise<ContentMetrics> {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  // Construire les filtres
  const photoWhere: Record<string, unknown> = {
    createdAt: { gte: startDate }
  }

  const generatedWhere: Record<string, unknown> = {
    createdAt: { gte: startDate }
  }

  const scheduledWhere: Record<string, unknown> = {
    createdAt: { gte: startDate }
  }

  if (influencerId) {
    // Filtrer les photos via la relation source
    photoWhere.source = { is: { influencerId } }
    generatedWhere.influencerId = influencerId
    scheduledWhere.influencerId = influencerId
  }

  // Compter les photos scrapées
  const photosScraped = await prisma.sourcePhoto.count({
    where: photoWhere
  })

  // Compter les photos approuvées
  const photosApproved = await prisma.sourcePhoto.count({
    where: {
      ...photoWhere,
      status: 'approved'
    }
  })

  // Compter les photos générées
  const photosGenerated = await prisma.generatedPhoto.count({
    where: generatedWhere
  })

  // Compter les posts programmés
  const postsScheduled = await prisma.scheduledPost.count({
    where: scheduledWhere
  })

  // Compter les posts publiés
  const postsPublished = await prisma.scheduledPost.count({
    where: {
      ...scheduledWhere,
      status: 'published'
    }
  })

  return {
    photosScraped,
    photosApproved,
    photosGenerated,
    postsScheduled,
    postsPublished,
    approvalRate: photosScraped > 0 ? (photosApproved / photosScraped) * 100 : 0
  }
}

/**
 * Récupère les métriques par influenceur
 */
export async function getInfluencerMetrics(): Promise<InfluencerMetrics[]> {
  const influencers = await prisma.influencer.findMany({
    include: {
      _count: {
        select: {
          pipelineRuns: true,
          scheduledPosts: true
        }
      },
      pipelineRuns: {
        orderBy: { startedAt: 'desc' },
        take: 10
      },
      sources: {
        include: {
          photos: {
            include: {
              _count: {
                select: {
                  generatedPhotos: true
                }
              }
            }
          }
        }
      }
    }
  })

  return influencers.map(inf => {
    const runs = inf.pipelineRuns
    const successfulRuns = runs.filter(r => r.status === 'completed').length
    const lastRun = runs.length > 0 ? runs[0].startedAt : null

    // Compter les photos générées via les sources
    const photosGenerated = inf.sources.reduce((total, source) => {
      return total + source.photos.reduce((sourceTotal, photo) => {
        return sourceTotal + photo._count.generatedPhotos
      }, 0)
    }, 0)

    return {
      id: inf.id,
      name: inf.name,
      handle: inf.handle,
      pipelineRuns: inf._count.pipelineRuns,
      lastRun,
      successRate: runs.length > 0 ? (successfulRuns / runs.length) * 100 : 100,
      photosGenerated,
      postsPublished: inf._count.scheduledPosts
    }
  })
}

/**
 * Récupère un résumé global pour le dashboard
 */
export async function getDashboardSummary(): Promise<{
  activeInfluencers: number
  totalPipelineRuns: number
  runningPipelines: number
  pendingPosts: number
  unreadAlerts: number
  todayCost: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    activeInfluencers,
    totalPipelineRuns,
    runningPipelines,
    pendingPosts,
    unreadAlerts,
    todayUsages
  ] = await Promise.all([
    // Influenceurs actifs (avec au moins un run dans les 30 jours)
    prisma.influencer.count({
      where: {
        pipelineRuns: {
          some: {
            startedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    }),
    // Total des runs
    prisma.pipelineRun.count(),
    // Pipelines en cours
    prisma.pipelineRun.count({
      where: { status: 'running' }
    }),
    // Posts en attente de publication
    prisma.scheduledPost.count({
      where: { status: 'scheduled' }
    }),
    // Alertes non lues
    prisma.alert.count({
      where: {
        isRead: false,
        isResolved: false
      }
    }),
    // Coûts du jour
    prisma.apiUsage.findMany({
      where: {
        timestamp: { gte: today }
      }
    })
  ])

  const todayCost = todayUsages.reduce((acc, u) => acc + u.estimatedCost, 0) / 100

  return {
    activeInfluencers,
    totalPipelineRuns,
    runningPipelines,
    pendingPosts,
    unreadAlerts,
    todayCost
  }
}

/**
 * Récupère l'historique des runs pour un graphique
 */
export async function getRunHistory(
  days: number = 30,
  influencerId?: string
): Promise<Array<{ date: string; success: number; failed: number }>> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const where: Record<string, unknown> = {
    startedAt: { gte: startDate }
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  const runs = await prisma.pipelineRun.findMany({
    where,
    orderBy: { startedAt: 'asc' }
  })

  // Grouper par jour
  const byDay: Record<string, { success: number; failed: number }> = {}

  for (const run of runs) {
    if (!run.startedAt) continue
    const day = run.startedAt.toISOString().split('T')[0]

    if (!byDay[day]) {
      byDay[day] = { success: 0, failed: 0 }
    }

    if (run.status === 'completed') {
      byDay[day].success++
    } else if (run.status === 'failed') {
      byDay[day].failed++
    }
  }

  return Object.entries(byDay).map(([date, data]) => ({
    date,
    ...data
  }))
}
