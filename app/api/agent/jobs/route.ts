import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/agent/jobs
 * Liste les jobs dans la file d'attente (pour monitoring)
 * Query params:
 *   - status : Filtrer par statut (pending, processing, completed, failed)
 *   - type : Filtrer par type (pipeline, scrape, generate, publish)
 *   - limit : Nombre de résultats (défaut: 50, max: 200)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    // Construire le filtre
    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    // Récupérer les jobs
    const jobs = await prisma.job.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    })

    // Statistiques
    const stats = await prisma.job.groupBy({
      by: ['status'],
      _count: { status: true }
    })

    const statsMap: Record<string, number> = {}
    stats.forEach(s => {
      statsMap[s.status] = s._count.status
    })

    return NextResponse.json({
      jobs,
      stats: {
        pending: statsMap.pending || 0,
        processing: statsMap.processing || 0,
        completed: statsMap.completed || 0,
        failed: statsMap.failed || 0
      }
    })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des jobs' },
      { status: 500 }
    )
  }
}
