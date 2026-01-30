import { NextRequest, NextResponse } from 'next/server'
import {
  getPipelineMetrics,
  getContentMetrics,
  getInfluencerMetrics,
  getDashboardSummary,
  getRunHistory
} from '@/lib/monitoring/metrics'
import { getCostStats, getDailyCostHistory } from '@/lib/monitoring/cost-tracking'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/metrics
 * Récupère les métriques pour le dashboard agent
 *
 * Query params:
 * - type: 'summary' | 'pipeline' | 'content' | 'influencers' | 'costs' | 'history'
 * - period: '24h' | '7d' | '30d' (pour pipeline, content, costs)
 * - influencerId: string (optionnel, pour filtrer par influenceur)
 * - days: number (pour history)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const period = (searchParams.get('period') || '7d') as '24h' | '7d' | '30d'
    const influencerId = searchParams.get('influencerId') || undefined
    const days = parseInt(searchParams.get('days') || '30')

    let data: unknown

    switch (type) {
      case 'summary':
        data = await getDashboardSummary()
        break

      case 'pipeline':
        data = await getPipelineMetrics(period, influencerId)
        break

      case 'content':
        data = await getContentMetrics(period, influencerId)
        break

      case 'influencers':
        data = await getInfluencerMetrics()
        break

      case 'costs':
        data = {
          stats: await getCostStats(period, influencerId),
          history: await getDailyCostHistory(days, influencerId)
        }
        break

      case 'history':
        data = await getRunHistory(days, influencerId)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid metrics type' },
          { status: 400 }
        )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Metrics API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
