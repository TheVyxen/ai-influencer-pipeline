/**
 * Service de publication Instagram via Graph API
 * Permet de publier des posts et carousels
 */

import { getDecryptedToken } from './oauth'

const GRAPH_API_URL = 'https://graph.instagram.com'

export interface PublishResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Upload une image vers Instagram (crée un container)
 * L'image doit être accessible via une URL publique
 */
async function createMediaContainer(
  userId: string,
  accessToken: string,
  imageUrl: string,
  caption?: string,
  isCarouselItem: boolean = false
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: accessToken
  }

  if (isCarouselItem) {
    params.is_carousel_item = 'true'
  } else if (caption) {
    params.caption = caption
  }

  const response = await fetch(`${GRAPH_API_URL}/${userId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to create media container')
  }

  const data = await response.json()
  return data.id
}

/**
 * Crée un container pour un carousel
 */
async function createCarouselContainer(
  userId: string,
  accessToken: string,
  childrenIds: string[],
  caption: string
): Promise<string> {
  const response = await fetch(`${GRAPH_API_URL}/${userId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childrenIds.join(','),
      caption,
      access_token: accessToken
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to create carousel container')
  }

  const data = await response.json()
  return data.id
}

/**
 * Publie un container média sur Instagram
 */
async function publishMedia(
  userId: string,
  accessToken: string,
  containerId: string
): Promise<string> {
  const response = await fetch(`${GRAPH_API_URL}/${userId}/media_publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to publish media')
  }

  const data = await response.json()
  return data.id
}

/**
 * Récupère l'URL d'un post Instagram
 */
async function getPostPermalink(
  postId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GRAPH_API_URL}/${postId}?fields=permalink&access_token=${accessToken}`
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.permalink
  } catch {
    return null
  }
}

/**
 * Publie une image sur Instagram
 */
export async function publishSingleImage(
  influencerId: string,
  imageUrl: string,
  caption: string
): Promise<PublishResult> {
  try {
    const accessToken = await getDecryptedToken(influencerId)

    if (!accessToken) {
      return {
        success: false,
        error: 'Instagram account not connected or token expired'
      }
    }

    // Récupérer l'ID utilisateur Instagram
    const account = await import('@/lib/prisma').then(m =>
      m.default.instagramAccount.findUnique({
        where: { influencerId }
      })
    )

    if (!account) {
      return {
        success: false,
        error: 'Instagram account not found'
      }
    }

    // Créer le container média
    const containerId = await createMediaContainer(
      account.instagramUserId,
      accessToken,
      imageUrl,
      caption
    )

    // Attendre que le container soit prêt (Instagram processing)
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Publier
    const postId = await publishMedia(
      account.instagramUserId,
      accessToken,
      containerId
    )

    // Récupérer l'URL du post
    const postUrl = await getPostPermalink(postId, accessToken)

    return {
      success: true,
      postId,
      postUrl: postUrl || undefined
    }
  } catch (error) {
    console.error('[Instagram] Publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Publie un carousel sur Instagram
 */
export async function publishCarousel(
  influencerId: string,
  imageUrls: string[],
  caption: string
): Promise<PublishResult> {
  try {
    if (imageUrls.length < 2 || imageUrls.length > 10) {
      return {
        success: false,
        error: 'Carousel must have between 2 and 10 images'
      }
    }

    const accessToken = await getDecryptedToken(influencerId)

    if (!accessToken) {
      return {
        success: false,
        error: 'Instagram account not connected or token expired'
      }
    }

    const account = await import('@/lib/prisma').then(m =>
      m.default.instagramAccount.findUnique({
        where: { influencerId }
      })
    )

    if (!account) {
      return {
        success: false,
        error: 'Instagram account not found'
      }
    }

    // Créer les containers pour chaque image du carousel
    const childrenIds: string[] = []

    for (const imageUrl of imageUrls) {
      const containerId = await createMediaContainer(
        account.instagramUserId,
        accessToken,
        imageUrl,
        undefined,
        true // isCarouselItem
      )
      childrenIds.push(containerId)

      // Petit délai entre les uploads
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Attendre le processing
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Créer le container carousel
    const carouselContainerId = await createCarouselContainer(
      account.instagramUserId,
      accessToken,
      childrenIds,
      caption
    )

    // Attendre le processing
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Publier
    const postId = await publishMedia(
      account.instagramUserId,
      accessToken,
      carouselContainerId
    )

    const postUrl = await getPostPermalink(postId, accessToken)

    return {
      success: true,
      postId,
      postUrl: postUrl || undefined
    }
  } catch (error) {
    console.error('[Instagram] Carousel publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
