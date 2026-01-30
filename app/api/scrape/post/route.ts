import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { scrapeInstagramPost, importScrapedPhoto, ApifyError } from '@/lib/apify'

/**
 * POST /api/scrape/post
 * Scrape un post Instagram par URL et importe les photos
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL du post requise' },
        { status: 400 }
      )
    }

    // Scraper le post
    const photos = await scrapeInstagramPost(url)

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Aucune image trouvée dans ce post' },
        { status: 404 }
      )
    }

    // Créer ou récupérer une source "Import manuel"
    let source = await prisma.source.findFirst({
      where: { username: '_import_manuel_' }
    })

    if (!source) {
      source = await prisma.source.create({
        data: {
          username: '_import_manuel_',
          isActive: false, // Pas de scraping auto pour cette source
        }
      })
    }

    // Importer les photos
    let imported = 0
    let skipped = 0

    for (const photo of photos) {
      try {
        const result = await importScrapedPhoto(source.id, photo)
        if (result) {
          imported++
        } else {
          skipped++
        }
      } catch (error) {
        console.error('Error importing photo:', error)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      photosFound: photos.length,
      photosImported: imported,
      photosSkipped: skipped,
    })
  } catch (error) {
    console.error('Error scraping post:', error)

    if (error instanceof ApifyError) {
      const statusCode = error.code === 'NOT_CONFIGURED' ? 503
        : error.code === 'NOT_FOUND' ? 404
        : error.code === 'PRIVATE_ACCOUNT' ? 403
        : error.code === 'RATE_LIMIT' ? 429
        : 500

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors du scraping du post' },
      { status: 500 }
    )
  }
}
