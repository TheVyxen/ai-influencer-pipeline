import { NextRequest, NextResponse } from 'next/server'
import { scrapeAndImportSource, isApifyConfigured, ApifyError } from '@/lib/apify'

/**
 * POST /api/scrape/[id]
 * Lance le scraping pour une source spécifique
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Vérifier si Apify est configuré
    const isConfigured = await isApifyConfigured()
    if (!isConfigured) {
      return NextResponse.json(
        { error: 'Configurez votre clé Apify dans Settings' },
        { status: 400 }
      )
    }

    // Lancer le scraping pour cette source
    const result = await scrapeAndImportSource(id)

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          result,
          error: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Error scraping source:', error)

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
