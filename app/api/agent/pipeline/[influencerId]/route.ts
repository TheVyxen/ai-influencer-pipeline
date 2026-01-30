import { NextRequest, NextResponse } from 'next/server'
import { createPipelineRun, executePipeline, getLatestPipelineRun } from '@/lib/agent/pipeline'
import { createPipelineJob } from '@/lib/agent/worker'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ influencerId: string }>
}

/**
 * GET /api/agent/pipeline/[influencerId]
 * Récupère le statut du dernier pipeline de l'influenceuse
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { influencerId } = await params

    // Vérifier que l'influenceuse existe
    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true, name: true, handle: true }
    })

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influenceuse non trouvée' },
        { status: 404 }
      )
    }

    // Récupérer le dernier pipeline run
    const latestRun = await getLatestPipelineRun(influencerId)

    return NextResponse.json({
      influencer,
      latestRun
    })
  } catch (error) {
    console.error('Error fetching pipeline status:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du statut' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agent/pipeline/[influencerId]
 * Déclenche un nouveau pipeline pour l'influenceuse
 * Query params:
 *   - async=true : Crée un job pour le worker (recommandé pour les environnements serverless)
 *   - async=false : Exécute le pipeline directement (pour les tests)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { influencerId } = await params
    const { searchParams } = new URL(request.url)
    const isAsync = searchParams.get('async') !== 'false'

    // Vérifier que l'influenceuse existe
    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true, name: true, handle: true }
    })

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influenceuse non trouvée' },
        { status: 404 }
      )
    }

    // Créer le pipeline run
    const pipelineRunId = await createPipelineRun(influencerId, 'manual')

    if (isAsync) {
      // Mode async : créer un job pour le worker
      const jobId = await createPipelineJob(pipelineRunId)

      return NextResponse.json({
        success: true,
        pipelineRunId,
        jobId,
        message: 'Pipeline créé et en attente d\'exécution par le worker'
      })
    } else {
      // Mode sync : exécuter directement (attention aux timeouts serverless)
      // Ne pas attendre la fin pour éviter les timeouts
      executePipeline(pipelineRunId).catch(error => {
        console.error(`Pipeline ${pipelineRunId} failed:`, error)
      })

      return NextResponse.json({
        success: true,
        pipelineRunId,
        message: 'Pipeline démarré en arrière-plan'
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Error triggering pipeline:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
