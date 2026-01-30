/**
 * Step 1 : Scrape
 * Scrape toutes les sources actives de l'influenceuse
 */

import prisma from '@/lib/prisma'
import { scrapeInstagramProfile, isApifyConfigured } from '@/lib/apify'
import { PipelineContext, StepResult } from '../types'

export async function executeScrapeStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId } = context

  // Vérifier que Apify est configuré
  if (!await isApifyConfigured()) {
    return {
      success: false,
      error: 'Apify API non configurée'
    }
  }

  // Récupérer les sources actives de l'influenceuse
  const sources = await prisma.source.findMany({
    where: {
      influencerId,
      isActive: true
    }
  })

  if (sources.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucune source active'
    }
  }

  const postsPerScrape = context.settings?.postsPerScrape || 10
  let totalScraped = 0
  let totalImported = 0
  const errors: string[] = []

  // Scraper chaque source
  for (const source of sources) {
    try {
      console.log(`[Scrape] Scraping ${source.username}...`)

      const photos = await scrapeInstagramProfile(source.username, postsPerScrape)

      // Importer les photos dans la base de données
      for (const photo of photos) {
        // Vérifier si la photo existe déjà (par URL du post + index carrousel)
        const existing = await prisma.sourcePhoto.findFirst({
          where: {
            instagramPostUrl: photo.postUrl,
            carouselIndex: photo.carouselIndex ?? null
          }
        })

        if (!existing) {
          await prisma.sourcePhoto.create({
            data: {
              sourceId: source.id,
              originalUrl: photo.url,
              instagramPostUrl: photo.postUrl,
              instagramPublishedAt: photo.timestamp ? new Date(photo.timestamp) : null,
              status: 'pending',
              isCarousel: photo.isCarousel,
              carouselId: photo.carouselId,
              carouselIndex: photo.carouselIndex,
              carouselTotal: photo.carouselTotal
            }
          })
          totalImported++
        }
      }

      totalScraped += photos.length
      console.log(`[Scrape] ${source.username}: ${photos.length} photos trouvées, ${totalImported} importées`)
    } catch (error) {
      const errorMsg = `Erreur sur ${source.username}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      console.error(`[Scrape] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  // Mettre à jour le contexte avec les IDs des photos scrapées
  const newPhotos = await prisma.sourcePhoto.findMany({
    where: {
      source: { influencerId },
      status: 'pending'
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: totalImported
  })

  context.scrapedPhotoIds = newPhotos.map(p => p.id)

  return {
    success: true,
    data: {
      sourcesScraped: sources.length,
      photosFound: totalScraped,
      photosScraped: totalImported,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}
