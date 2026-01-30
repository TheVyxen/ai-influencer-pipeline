/**
 * Service de suivi des coûts API
 * Track les utilisations et estime les coûts
 */

import prisma from '@/lib/prisma'

// Coûts estimés par opération (en centimes USD)
const COST_ESTIMATES: Record<string, Record<string, number>> = {
  gemini: {
    describe: 0.15,      // ~$0.0015 pour la description
    validate: 0.10,      // ~$0.001 pour la validation
    generate: 4.0,       // ~$0.04 pour la génération
    caption: 0.15        // ~$0.0015 pour la caption
  },
  wavespeed: {
    generate: 3.0        // ~$0.03 par génération
  },
  apify: {
    scrape: 0.5          // ~$0.005 par scrape (varie selon usage)
  },
  instagram: {
    publish: 0           // Gratuit (mais limité)
  }
}

export type Provider = 'gemini' | 'wavespeed' | 'apify' | 'instagram'
export type Operation = 'describe' | 'validate' | 'generate' | 'caption' | 'scrape' | 'publish'

/**
 * Enregistre une utilisation API
 */
export async function trackApiUsage(
  provider: Provider,
  operation: Operation,
  influencerId?: string,
  successful: boolean = true,
  errorMessage?: string
): Promise<void> {
  const estimatedCost = COST_ESTIMATES[provider]?.[operation] || 0

  await prisma.apiUsage.create({
    data: {
      influencerId,
      provider,
      operation,
      estimatedCost: Math.round(estimatedCost),
      successful,
      errorMessage
    }
  })
}

/**
 * Récupère les statistiques de coûts pour une période
 */
export async function getCostStats(
  period: '24h' | '7d' | '30d',
  influencerId?: string
): Promise<{
  totalCost: number
  byProvider: Record<string, number>
  byOperation: Record<string, number>
  successRate: number
  totalCalls: number
}> {
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
    timestamp: {
      gte: startDate
    }
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  const usages = await prisma.apiUsage.findMany({
    where
  })

  // Calculer les stats
  const byProvider: Record<string, number> = {}
  const byOperation: Record<string, number> = {}
  let totalCost = 0
  let successfulCalls = 0

  for (const usage of usages) {
    // Par provider
    byProvider[usage.provider] = (byProvider[usage.provider] || 0) + usage.estimatedCost

    // Par opération
    byOperation[usage.operation] = (byOperation[usage.operation] || 0) + usage.estimatedCost

    // Total
    totalCost += usage.estimatedCost

    if (usage.successful) {
      successfulCalls++
    }
  }

  return {
    totalCost: totalCost / 100, // Convertir en dollars
    byProvider: Object.fromEntries(
      Object.entries(byProvider).map(([k, v]) => [k, v / 100])
    ),
    byOperation: Object.fromEntries(
      Object.entries(byOperation).map(([k, v]) => [k, v / 100])
    ),
    successRate: usages.length > 0 ? (successfulCalls / usages.length) * 100 : 100,
    totalCalls: usages.length
  }
}

/**
 * Récupère l'historique des coûts jour par jour
 */
export async function getDailyCostHistory(
  days: number = 30,
  influencerId?: string
): Promise<Array<{ date: string; cost: number; calls: number }>> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const where: Record<string, unknown> = {
    timestamp: {
      gte: startDate
    }
  }

  if (influencerId) {
    where.influencerId = influencerId
  }

  const usages = await prisma.apiUsage.findMany({
    where,
    orderBy: { timestamp: 'asc' }
  })

  // Grouper par jour
  const byDay: Record<string, { cost: number; calls: number }> = {}

  for (const usage of usages) {
    const day = usage.timestamp.toISOString().split('T')[0]

    if (!byDay[day]) {
      byDay[day] = { cost: 0, calls: 0 }
    }

    byDay[day].cost += usage.estimatedCost
    byDay[day].calls++
  }

  // Convertir en array et en dollars
  return Object.entries(byDay).map(([date, data]) => ({
    date,
    cost: data.cost / 100,
    calls: data.calls
  }))
}
