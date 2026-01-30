import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createPipelineRun } from '@/lib/agent/pipeline'
import { createPipelineJob } from '@/lib/agent/worker'

// Force dynamic pour éviter le pré-rendu statique
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/agent-pipeline
 * Endpoint appelé par Vercel Cron pour déclencher les pipelines automatiques
 * Vérifie quelles influenceuses doivent avoir un pipeline déclenché
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret pour sécuriser l'endpoint cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // En production, vérifier le secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer les influenceuses avec agent activé
    const influencers = await prisma.influencer.findMany({
      where: {
        isActive: true,
        agentEnabled: true
      },
      select: {
        id: true,
        name: true,
        agentInterval: true,
        lastAgentRun: true
      }
    })

    if (influencers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucune influenceuse avec agent activé',
        triggered: 0
      })
    }

    const now = Date.now()
    const triggered: string[] = []
    const skipped: string[] = []

    for (const influencer of influencers) {
      // Calculer si le pipeline doit être déclenché
      const intervalMs = influencer.agentInterval * 60 * 60 * 1000
      const lastRunTime = influencer.lastAgentRun?.getTime() || 0
      const timeSinceLastRun = now - lastRunTime

      if (timeSinceLastRun >= intervalMs) {
        try {
          // Créer le pipeline et le job
          const pipelineRunId = await createPipelineRun(influencer.id, 'cron')
          await createPipelineJob(pipelineRunId)

          triggered.push(influencer.name)
          console.log(`[Cron] Pipeline déclenché pour ${influencer.name}`)
        } catch (error) {
          // Pipeline déjà en cours probablement
          console.log(`[Cron] Impossible de déclencher pour ${influencer.name}:`, error)
          skipped.push(`${influencer.name} (erreur)`)
        }
      } else {
        const nextRunIn = Math.ceil((intervalMs - timeSinceLastRun) / (60 * 60 * 1000))
        skipped.push(`${influencer.name} (prochain dans ${nextRunIn}h)`)
      }
    }

    return NextResponse.json({
      success: true,
      triggered: triggered.length,
      triggeredInfluencers: triggered,
      skipped: skipped.length,
      skippedInfluencers: skipped
    })
  } catch (error) {
    console.error('[Cron] Agent pipeline error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
