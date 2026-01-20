import { NextRequest, NextResponse } from 'next/server'
import {
  scrapeAndImportSource,
  scrapeAndImportMultipleSources,
  isApifyConfigured,
  ApifyError,
  ScrapeResult
} from '@/lib/apify'

/**
 * État global du scraping en cours (pour le suivi du statut)
 * En production, utiliser Redis ou une BDD
 */
let currentScrapeStatus: {
  isRunning: boolean
  startedAt: Date | null
  sourceIds: string[]
  results: ScrapeResult[]
  currentIndex: number
  totalSources: number
} = {
  isRunning: false,
  startedAt: null,
  sourceIds: [],
  results: [],
  currentIndex: 0,
  totalSources: 0,
}

/**
 * POST /api/scrape
 * Lance le scraping pour les sources spécifiées
 * Body: { sourceIds?: string[] } - Si vide, scrape toutes les sources actives
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier si Apify est configuré
    const isConfigured = await isApifyConfigured()
    if (!isConfigured) {
      return NextResponse.json(
        { error: 'Configurez votre clé Apify dans Settings' },
        { status: 400 }
      )
    }

    // Vérifier si un scrape est déjà en cours
    if (currentScrapeStatus.isRunning) {
      return NextResponse.json(
        { error: 'Un scrape est déjà en cours' },
        { status: 409 }
      )
    }

    // Récupérer les IDs des sources depuis le body
    const body = await request.json().catch(() => ({}))
    const { sourceIds } = body as { sourceIds?: string[] }

    // Lancer le scraping
    currentScrapeStatus = {
      isRunning: true,
      startedAt: new Date(),
      sourceIds: sourceIds || [],
      results: [],
      currentIndex: 0,
      totalSources: 0,
    }

    try {
      const results = await scrapeAndImportMultipleSources(sourceIds)
      currentScrapeStatus.results = results
      currentScrapeStatus.totalSources = results.length

      // Calculer les totaux
      const totals = results.reduce(
        (acc, result) => ({
          photosFound: acc.photosFound + result.photosFound,
          photosImported: acc.photosImported + result.photosImported,
          photosSkipped: acc.photosSkipped + result.photosSkipped,
          errors: acc.errors + (result.error ? 1 : 0),
        }),
        { photosFound: 0, photosImported: 0, photosSkipped: 0, errors: 0 }
      )

      return NextResponse.json({
        success: true,
        results,
        totals,
      })
    } finally {
      // Marquer le scrape comme terminé
      currentScrapeStatus.isRunning = false
    }
  } catch (error) {
    console.error('Error in scrape API:', error)
    currentScrapeStatus.isRunning = false

    if (error instanceof ApifyError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 400,
        'PRIVATE_ACCOUNT': 400,
        'NOT_FOUND': 404,
        'RATE_LIMIT': 429,
        'API_ERROR': 502,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors du scraping' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/scrape
 * Récupère le statut du scrape en cours
 */
export async function GET() {
  return NextResponse.json({
    isRunning: currentScrapeStatus.isRunning,
    startedAt: currentScrapeStatus.startedAt?.toISOString() || null,
    currentIndex: currentScrapeStatus.currentIndex,
    totalSources: currentScrapeStatus.totalSources,
    results: currentScrapeStatus.results,
  })
}
