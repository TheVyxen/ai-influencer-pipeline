import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Force dynamic pour éviter le cache
export const dynamic = 'force-dynamic'

/**
 * GET /api/stats
 * Récupère les statistiques du dashboard
 * @param influencerId - Optionnel, filtre par influenceur
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')

    // Filtres conditionnels pour chaque requête
    const sourceFilter = influencerId ? { influencerId } : undefined
    const photoFilter = influencerId ? { source: { influencerId } } : undefined
    const generatedFilter = influencerId ? { sourcePhoto: { source: { influencerId } } } : undefined

    const [
      sourcesCount,
      pendingCount,
      generatedCount,
      lastGenerated
    ] = await Promise.all([
      prisma.source.count({ where: sourceFilter }),
      prisma.sourcePhoto.count({
        where: {
          status: 'pending',
          ...photoFilter
        }
      }),
      prisma.generatedPhoto.count({ where: generatedFilter }),
      prisma.generatedPhoto.findFirst({
        where: generatedFilter,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ])

    return NextResponse.json({
      sourcesCount,
      pendingCount,
      generatedCount,
      lastActivity: lastGenerated?.createdAt?.toISOString() || null
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
