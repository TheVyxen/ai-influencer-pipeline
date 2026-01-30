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
 * Supporte les images individuelles et les carrousels
 */
export interface ApifyPhoto {
  url: string              // URL de l'image
  postUrl: string          // URL du post Instagram
  timestamp: string        // Date du post
  caption?: string         // Légende du post
  isCarousel: boolean      // true si fait partie d'un carrousel
  carouselId?: string      // ID unique du carrousel (pour regrouper)
  carouselIndex?: number   // Position dans le carrousel (0, 1, 2...)
  carouselTotal?: number   // Nombre total d'images dans le carrousel
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
    const setting = await prisma.appSettings.findUnique({
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
    const setting = await prisma.appSettings.findUnique({
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
      const itemObj = item as Record<string, unknown>
      const postUrl = (itemObj.url as string) || `https://www.instagram.com/p/${itemObj.shortCode}/`
      const timestamp = (itemObj.timestamp as string) || new Date().toISOString()
      const caption = itemObj.caption as string | undefined
      const postId = (itemObj.id as string) || (itemObj.shortCode as string)

      // Extraire toutes les URLs d'images avec la fonction améliorée
      const imageUrls = extractImageUrls(itemObj)

      if (imageUrls.length === 0) {
        // Pas d'images (peut-être une vidéo), ignorer
        continue
      }

      const isCarousel = imageUrls.length > 1

      imageUrls.forEach((imageUrl, index) => {
        photos.push({
          url: imageUrl,
          postUrl,
          timestamp,
          caption,
          isCarousel,
          carouselId: isCarousel ? postId : undefined,
          carouselIndex: isCarousel ? index : undefined,
          carouselTotal: isCarousel ? imageUrls.length : undefined,
        })
      })
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
 * Extrait les URLs d'images depuis différents formats de réponse Apify
 * Le format peut varier selon le type de post
 */
function extractImageUrls(item: Record<string, unknown>): string[] {
  const urls: string[] = []

  // 1. Vérifier le champ "image" (singulier - format courant)
  if (typeof item.image === 'string' && item.image.startsWith('http')) {
    urls.push(item.image)
  }

  // 2. Vérifier le champ "images" (tableau de strings ou d'objets)
  if (item.images && Array.isArray(item.images)) {
    for (const img of item.images) {
      if (typeof img === 'string' && img.startsWith('http')) {
        urls.push(img)
      } else if (img && typeof img === 'object') {
        // Parfois les images sont des objets avec une propriété url
        const imgObj = img as Record<string, unknown>
        if (typeof imgObj.url === 'string') urls.push(imgObj.url)
        else if (typeof imgObj.src === 'string') urls.push(imgObj.src)
      }
    }
  }

  // 3. Vérifier "displayUrl" (image principale)
  if (urls.length === 0 && typeof item.displayUrl === 'string') {
    urls.push(item.displayUrl)
  }

  // 4. Vérifier "imageUrl" (alternative)
  if (urls.length === 0 && typeof item.imageUrl === 'string') {
    urls.push(item.imageUrl)
  }

  // 5. Vérifier "thumbnailUrl" (fallback)
  if (urls.length === 0 && typeof item.thumbnailUrl === 'string') {
    urls.push(item.thumbnailUrl)
  }

  // 6. Vérifier "sidecarImages" (pour les carrousels)
  if (item.sidecarImages && Array.isArray(item.sidecarImages)) {
    for (const img of item.sidecarImages) {
      if (typeof img === 'string' && img.startsWith('http')) {
        urls.push(img)
      } else if (img && typeof img === 'object') {
        const imgObj = img as Record<string, unknown>
        if (typeof imgObj.url === 'string') urls.push(imgObj.url)
        else if (typeof imgObj.src === 'string') urls.push(imgObj.src)
        else if (typeof imgObj.displayUrl === 'string') urls.push(imgObj.displayUrl)
      }
    }
  }

  // 7. Vérifier "childPosts" (autre format de carrousel)
  if (item.childPosts && Array.isArray(item.childPosts)) {
    for (const child of item.childPosts) {
      if (child && typeof child === 'object') {
        const childObj = child as Record<string, unknown>
        if (typeof childObj.displayUrl === 'string') urls.push(childObj.displayUrl)
        else if (typeof childObj.imageUrl === 'string') urls.push(childObj.imageUrl)
        else if (typeof childObj.image === 'string') urls.push(childObj.image)
      }
    }
  }

  // Dédupliquer et filtrer les URLs valides
  return Array.from(new Set(urls)).filter(url => url && url.startsWith('http'))
}

/**
 * Scrape un post Instagram spécifique par URL
 * @param postUrl - URL du post Instagram (ex: https://www.instagram.com/p/ABC123/)
 * @returns Liste des photos du post (peut être un carrousel)
 */
export async function scrapeInstagramPost(postUrl: string): Promise<ApifyPhoto[]> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new ApifyError(
      'Configurez votre clé Apify dans Settings',
      'NOT_CONFIGURED'
    )
  }

  // Valider et nettoyer l'URL
  let cleanUrl = postUrl.trim()

  // Vérifier que c'est une URL Instagram valide
  const instagramPostRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?/
  if (!instagramPostRegex.test(cleanUrl)) {
    throw new ApifyError(
      'URL Instagram invalide. Format attendu: https://www.instagram.com/p/ABC123/',
      'NOT_FOUND'
    )
  }

  try {
    const client = new ApifyClient({ token: apiKey })

    // Lancer l'actor Instagram Scraper avec l'URL du post
    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: [cleanUrl],
      resultsType: 'posts',
      resultsLimit: 1,
    })

    // Récupérer les résultats
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    if (!items || items.length === 0) {
      throw new ApifyError(
        'Post non trouvé ou inaccessible',
        'NOT_FOUND'
      )
    }

    // Transformer les résultats en format ApifyPhoto
    const photos: ApifyPhoto[] = []
    const item = items[0] as Record<string, unknown>

    // Log pour debug
    console.log('Apify response keys:', Object.keys(item))
    console.log('Item type:', item.type)
    console.log('Has image (singular):', !!item.image, typeof item.image === 'string' ? item.image.substring(0, 50) + '...' : '')
    console.log('Has images:', !!item.images, Array.isArray(item.images) ? (item.images as unknown[]).length : 0)
    console.log('Has displayUrl:', !!item.displayUrl)
    console.log('Has sidecarImages:', !!item.sidecarImages)
    console.log('Has childPosts:', !!item.childPosts)
    console.log('Error fields:', item.error, item.errorDescription)

    const finalPostUrl = (item.url as string) || cleanUrl
    const timestamp = (item.timestamp as string) || new Date().toISOString()
    const caption = item.caption as string | undefined
    const postId = (item.id as string) || (item.shortCode as string)

    // Extraire toutes les URLs d'images
    const imageUrls = extractImageUrls(item)

    console.log('Extracted image URLs:', imageUrls.length)

    if (imageUrls.length === 0) {
      // Vérifier si c'est une vidéo/reel
      if (item.type === 'Video' || item.videoUrl || item.isVideo) {
        throw new ApifyError(
          'Ce post est une vidéo/reel, pas une image',
          'NOT_FOUND'
        )
      }
      return []
    }

    // Créer les ApifyPhoto
    const isCarousel = imageUrls.length > 1

    imageUrls.forEach((imageUrl, index) => {
      photos.push({
        url: imageUrl,
        postUrl: finalPostUrl,
        timestamp,
        caption,
        isCarousel,
        carouselId: isCarousel ? postId : undefined,
        carouselIndex: isCarousel ? index : undefined,
        carouselTotal: isCarousel ? imageUrls.length : undefined,
      })
    })

    return photos
  } catch (error) {
    if (error instanceof ApifyError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('private') || errorMessage.includes('Private')) {
      throw new ApifyError('Ce post provient d\'un compte privé', 'PRIVATE_ACCOUNT')
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new ApifyError('Post non trouvé', 'NOT_FOUND')
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new ApifyError('Limite Apify atteinte, réessayez plus tard', 'RATE_LIMIT')
    }

    if (errorMessage.includes('Invalid API token') || errorMessage.includes('401')) {
      throw new ApifyError('Clé API Apify invalide', 'NOT_CONFIGURED')
    }

    throw new ApifyError(`Erreur lors du scraping: ${errorMessage}`, 'API_ERROR')
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
 * Vérifie les doublons via instagramPostUrl + carouselIndex
 * NOTE: Les images ne sont pas téléchargées - on utilise directement originalUrl
 * @param sourceId - ID de la source Instagram
 * @param photo - Données de la photo scrapée
 * @returns SourcePhoto créée ou null si doublon
 */
export async function importScrapedPhoto(
  sourceId: string,
  photo: ApifyPhoto
): Promise<{ id: string; originalUrl: string; status: string } | null> {
  // Vérifier si cette photo existe déjà (doublon basé sur postUrl + carouselIndex)
  const carouselIndexValue = photo.carouselIndex ?? null

  const existing = await prisma.sourcePhoto.findFirst({
    where: {
      instagramPostUrl: photo.postUrl,
      carouselIndex: carouselIndexValue,
    }
  })

  if (existing) {
    // Photo déjà importée, retourner null
    console.log(`Photo déjà importée: ${photo.postUrl} [index: ${carouselIndexValue}]`)
    return null
  }

  // Parser la date de publication Instagram
  let instagramPublishedAt: Date | null = null
  if (photo.timestamp) {
    const parsed = new Date(photo.timestamp)
    if (!isNaN(parsed.getTime())) {
      instagramPublishedAt = parsed
    }
  }

  // Créer l'entrée dans la base de données avec les infos carrousel
  // NOTE: localPath n'est plus utilisé sur Vercel, on garde originalUrl
  const sourcePhoto = await prisma.sourcePhoto.create({
    data: {
      sourceId,
      originalUrl: photo.url,
      localPath: null, // Plus de stockage local sur Vercel
      instagramPostUrl: photo.postUrl,
      instagramPublishedAt, // Date de publication sur Instagram
      status: 'pending',
      description: photo.caption?.substring(0, 500) || null, // Limiter la description
      // Champs carrousel
      isCarousel: photo.isCarousel,
      carouselId: photo.carouselId || null,
      carouselIndex: photo.carouselIndex ?? null,
      carouselTotal: photo.carouselTotal || null,
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
