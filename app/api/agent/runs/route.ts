import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/agent/runs
 * Liste les pipeline runs avec pagination et filtres
 * Query params:
 *   - influencerId : Filtrer par influenceuse
 *   - status : Filtrer par statut (pending, running, completed, failed, cancelled)
 *   - limit : Nombre de résultats (défaut: 20, max: 100)
 *   - offset : Offset pour la pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const influencerId = searchParams.get('influencerId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Construire le filtre
    const where: Record<string, unknown> = {}

    if (influencerId) {
      where.influencerId = influencerId
    }

    if (status) {
      where.status = status
    }

    // Récupérer les runs avec pagination
    const [runs, total] = await Promise.all([
      prisma.pipelineRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          influencer: {
            select: { id: true, name: true, handle: true, avatarData: true }
          },
          steps: {
            orderBy: { id: 'asc' }
          }
        }
      }),
      prisma.pipelineRun.count({ where })
    ])

    return NextResponse.json({
      runs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching pipeline runs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des runs' },
      { status: 500 }
    )
  }
}
