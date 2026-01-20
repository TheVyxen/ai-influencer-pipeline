/**
 * Service Apify pour le scraping Instagram
 * Documentation: https://apify.com/apify/instagram-scraper
 *
 * NOTE: Les images ne sont plus téléchargées localement (compatible Vercel serverless)
 * On utilise directement les URLs Instagram (originalUrl)
 */

import { ApifyClient } from 'apify-client'
import prisma from './prisma'

/**
 * Structure d'une photo Instagram scrapée par Apify
 */
export interface ApifyPhoto {
  url: string           // URL de l'image
  postUrl: string       // URL du post Instagram
  timestamp: string     // Date du post
  caption?: string      // Légende du post
}

/**
 * Erreurs spécifiques au service Apify
 */
export class ApifyError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'PRIVATE_ACCOUNT' | 'NOT_FOUND' | 'RATE_LIMIT' | 'API_ERROR' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'ApifyError'
  }
}

/**
 * Récupère la clé API Apify (depuis env ou Settings)
 */
async function getApiKey(): Promise<string | null> {
  // D'abord vérifier les variables d'environnement
  if (process.env.APIFY_API_KEY) {
    return process.env.APIFY_API_KEY
  }

  // Sinon chercher dans les Settings
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'apify_api_key' }
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * Récupère le nombre de posts à scraper par profil (depuis Settings)
 */
export async function getPostsPerScrape(): Promise<number> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'posts_per_scrape' }
    })
    const value = parseInt(setting?.value || '10', 10)
    return isNaN(value) ? 10 : Math.max(1, Math.min(50, value)) // Entre 1 et 50
  } catch {
    return 10
  }
}

/**
 * Vérifie si la clé API Apify est configurée
 */
export async function isApifyConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  return Boolean(apiKey && apiKey.length > 0)
}

/**
 * Scrape les dernières photos d'un compte Instagram
 * @param username - Nom d'utilisateur Instagram (sans @)
 * @param limit - Nombre maximum de photos à récupérer
 * @returns Liste des photos scrapées
 */
export async function scrapeInstagramProfile(
  username: string,
  limit: number = 10
): Promise<ApifyPhoto[]> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new ApifyError(
      'Configurez votre clé Apify dans Settings',
      'NOT_CONFIGURED'
    )
  }

  // Nettoyer le username (enlever @ si présent)
  const cleanUsername = username.replace(/^@/, '').trim()

  if (!cleanUsername) {
    throw new ApifyError(
      'Nom d\'utilisateur invalide',
      'NOT_FOUND'
    )
  }

  try {
    const client = new ApifyClient({ token: apiKey })

    // Lancer l'actor Instagram Scraper
    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: [`https://www.instagram.com/${cleanUsername}/`],
      resultsType: 'posts',
      resultsLimit: limit,
      // Ne pas inclure les stories, reels, etc.
      searchType: 'user',
    })

    // Récupérer les résultats
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    // Transformer les résultats en format ApifyPhoto
    const photos: ApifyPhoto[] = []

    for (const item of items) {
      // Chaque item peut contenir une image ou plusieurs (carrousel)
      const imageUrls: string[] = []

      // Image principale
      if (item.displayUrl) {
        imageUrls.push(item.displayUrl as string)
      }

      // Images du carrousel
      if (item.images && Array.isArray(item.images)) {
        for (const img of item.images) {
          if (img && typeof img === 'string') {
            imageUrls.push(img)
          }
        }
      }

      // Créer une entrée pour chaque image
      for (const url of imageUrls) {
        photos.push({
          url,
          postUrl: (item.url as string) || `https://www.instagram.com/p/${item.shortCode}/`,
          timestamp: (item.timestamp as string) || new Date().toISOString(),
          caption: item.caption as string | undefined,
        })
      }
    }

    return photos
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Gérer les erreurs spécifiques
    if (errorMessage.includes('private') || errorMessage.includes('Private')) {
      throw new ApifyError(
        `Le compte @${cleanUsername} est privé`,
        'PRIVATE_ACCOUNT'
      )
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404') || errorMessage.includes('does not exist')) {
      throw new ApifyError(
        `Le compte @${cleanUsername} n'existe pas`,
        'NOT_FOUND'
      )
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('too many')) {
      throw new ApifyError(
        'Limite Apify atteinte, réessayez plus tard',
        'RATE_LIMIT'
      )
    }

    if (errorMessage.includes('Invalid API token') || errorMessage.includes('401')) {
      throw new ApifyError(
        'Clé API Apify invalide',
        'NOT_CONFIGURED'
      )
    }

    throw new ApifyError(
      `Erreur lors du scraping: ${errorMessage}`,
      'API_ERROR'
    )
  }
}

/**
 * Scrape plusieurs comptes Instagram
 * @param usernames - Liste des noms d'utilisateur
 * @param limitPerProfile - Nombre max de photos par profil
 * @returns Map username -> photos
 */
export async function scrapeMultipleProfiles(
  usernames: string[],
  limitPerProfile: number = 10
): Promise<Map<string, ApifyPhoto[]>> {
  const results = new Map<string, ApifyPhoto[]>()

  for (const username of usernames) {
    try {
      const photos = await scrapeInstagramProfile(username, limitPerProfile)
      results.set(username, photos)
    } catch (error) {
      console.error(`Error scraping @${username}:`, error)
      results.set(username, []) // Retourner un tableau vide en cas d'erreur
    }
  }

  return results
}

/**
 * Importe une photo scrapée dans la base de données
 * Vérifie les doublons via instagramPostUrl
 * NOTE: Les images ne sont pas téléchargées - on utilise directement originalUrl
 * @param sourceId - ID de la source Instagram
 * @param photo - Données de la photo scrapée
 * @returns SourcePhoto créée ou null si doublon
 */
export async function importScrapedPhoto(
  sourceId: string,
  photo: ApifyPhoto
): Promise<{ id: string; originalUrl: string; status: string } | null> {
  // Vérifier si cette photo existe déjà (doublon)
  const existing = await prisma.sourcePhoto.findUnique({
    where: { instagramPostUrl: photo.postUrl }
  })

  if (existing) {
    // Photo déjà importée, retourner null
    return null
  }

  // Créer l'entrée dans la base de données
  // NOTE: localPath n'est plus utilisé sur Vercel, on garde originalUrl
  const sourcePhoto = await prisma.sourcePhoto.create({
    data: {
      sourceId,
      originalUrl: photo.url,
      localPath: null, // Plus de stockage local sur Vercel
      instagramPostUrl: photo.postUrl,
      status: 'pending',
      description: photo.caption?.substring(0, 500) || null, // Limiter la description
    }
  })

  return {
    id: sourcePhoto.id,
    originalUrl: sourcePhoto.originalUrl,
    status: sourcePhoto.status,
  }
}

/**
 * Résultat du scraping d'une source
 */
export interface ScrapeResult {
  sourceId: string
  username: string
  photosFound: number
  photosImported: number
  photosSkipped: number // Doublons
  error?: string
}

/**
 * Scrape et importe les photos d'une source
 * @param sourceId - ID de la source à scraper
 * @returns Résultat du scraping
 */
export async function scrapeAndImportSource(sourceId: string): Promise<ScrapeResult> {
  // Récupérer la source
  const source = await prisma.source.findUnique({
    where: { id: sourceId }
  })

  if (!source) {
    return {
      sourceId,
      username: 'unknown',
      photosFound: 0,
      photosImported: 0,
      photosSkipped: 0,
      error: 'Source non trouvée',
    }
  }

  const result: ScrapeResult = {
    sourceId,
    username: source.username,
    photosFound: 0,
    photosImported: 0,
    photosSkipped: 0,
  }

  try {
    // Récupérer le nombre de posts à scraper
    const limit = await getPostsPerScrape()

    // Scraper le profil
    const photos = await scrapeInstagramProfile(source.username, limit)
    result.photosFound = photos.length

    // Importer chaque photo
    for (const photo of photos) {
      try {
        const imported = await importScrapedPhoto(sourceId, photo)
        if (imported) {
          result.photosImported++
        } else {
          result.photosSkipped++
        }
      } catch (error) {
        console.error('Error importing photo:', error)
        result.photosSkipped++
      }
    }
  } catch (error) {
    if (error instanceof ApifyError) {
      result.error = error.message
    } else {
      result.error = error instanceof Error ? error.message : 'Erreur inconnue'
    }
  }

  return result
}

/**
 * Scrape et importe les photos de plusieurs sources
 * @param sourceIds - IDs des sources (si vide, toutes les sources actives)
 * @returns Résultats du scraping par source
 */
export async function scrapeAndImportMultipleSources(
  sourceIds?: string[]
): Promise<ScrapeResult[]> {
  // Si pas d'IDs fournis, récupérer toutes les sources actives
  let sources
  if (sourceIds && sourceIds.length > 0) {
    sources = await prisma.source.findMany({
      where: { id: { in: sourceIds } }
    })
  } else {
    sources = await prisma.source.findMany({
      where: { isActive: true }
    })
  }

  const results: ScrapeResult[] = []

  for (const source of sources) {
    const result = await scrapeAndImportSource(source.id)
    results.push(result)
  }

  return results
}
