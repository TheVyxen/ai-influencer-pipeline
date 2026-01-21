import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Force dynamic pour éviter le cache
export const dynamic = 'force-dynamic'

/**
 * GET /api/stats
 * Récupère les statistiques du dashboard
 */
export async function GET() {
  try {
    const [
      sourcesCount,
      pendingCount,
      generatedCount,
      lastGenerated
    ] = await Promise.all([
      prisma.source.count(),
      prisma.sourcePhoto.count({ where: { status: 'pending' } }),
      prisma.generatedPhoto.count(),
      prisma.generatedPhoto.findFirst({
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
