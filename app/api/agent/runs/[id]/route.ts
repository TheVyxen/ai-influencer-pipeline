import { NextRequest, NextResponse } from 'next/server'
import { getPipelineStatus, cancelPipeline } from '@/lib/agent/pipeline'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/agent/runs/[id]
 * Récupère les détails d'un pipeline run
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const run = await getPipelineStatus(id)

    if (!run) {
      return NextResponse.json(
        { error: 'Pipeline run non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error('Error fetching pipeline run:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du run' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agent/runs/[id]
 * Actions sur un pipeline run
 * Body: { action: 'cancel' }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.action === 'cancel') {
      await cancelPipeline(id)
      return NextResponse.json({
        success: true,
        message: 'Pipeline annulé'
      })
    }

    return NextResponse.json(
      { error: 'Action non reconnue' },
      { status: 400 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Error performing action on pipeline run:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
