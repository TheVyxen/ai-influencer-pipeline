import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { scrapeAndImportMultipleSources } from '@/lib/apify'

// Force dynamic pour éviter le pré-rendu statique
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/scrape
 * Endpoint appelé par Vercel Cron pour le scraping automatique
 * Vérifie si l'intervalle configuré est écoulé avant de lancer le scrape
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

    // Récupérer les settings
    const [enabledSetting, intervalSetting, lastScrapeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'auto_scrape_enabled' } }),
      prisma.settings.findUnique({ where: { key: 'auto_scrape_interval' } }),
      prisma.settings.findUnique({ where: { key: 'last_auto_scrape' } }),
    ])

    // Vérifier si le scrape auto est activé
    const isEnabled = enabledSetting?.value === 'true'
    if (!isEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Auto-scrape is disabled',
        skipped: true,
      })
    }

    // Récupérer l'intervalle (en heures)
    const intervalHours = parseInt(intervalSetting?.value || '24', 10)
    const intervalMs = intervalHours * 60 * 60 * 1000

    // Vérifier si assez de temps s'est écoulé depuis le dernier scrape
    const lastScrapeTime = lastScrapeSetting?.value
      ? new Date(lastScrapeSetting.value).getTime()
      : 0
    const now = Date.now()
    const timeSinceLastScrape = now - lastScrapeTime

    if (timeSinceLastScrape < intervalMs) {
      const nextScrapeIn = Math.ceil((intervalMs - timeSinceLastScrape) / (60 * 60 * 1000))
      return NextResponse.json({
        success: true,
        message: `Next scrape in ${nextScrapeIn} hour(s)`,
        skipped: true,
        lastScrape: lastScrapeSetting?.value,
        nextScrapeIn: `${nextScrapeIn}h`,
      })
    }

    // Lancer le scraping de toutes les sources actives
    console.log('[CRON] Starting auto-scrape...')
    const results = await scrapeAndImportMultipleSources()

    // Mettre à jour le timestamp du dernier scrape
    await prisma.settings.upsert({
      where: { key: 'last_auto_scrape' },
      update: { value: new Date().toISOString() },
      create: { key: 'last_auto_scrape', value: new Date().toISOString() },
    })

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

    console.log(`[CRON] Auto-scrape completed: ${totals.photosImported} photos imported`)

    return NextResponse.json({
      success: true,
      message: `Auto-scrape completed: ${totals.photosImported} photos imported`,
      results,
      totals,
    })
  } catch (error) {
    console.error('[CRON] Auto-scrape error:', error)
    return NextResponse.json(
      { error: 'Auto-scrape failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
