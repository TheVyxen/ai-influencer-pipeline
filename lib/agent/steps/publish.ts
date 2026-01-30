/**
 * Step 7 : Publish
 * Publie les posts programmés sur Instagram
 * Ce step est optionnel et ne fait partie du pipeline que si
 * le compte Instagram est connecté et qu'il y a des posts à publier immédiatement
 */

import prisma from '@/lib/prisma'
import { PipelineContext, StepResult } from '../types'
import { publishSingleImage, publishCarousel } from '@/lib/instagram/publish'
import { prepareImageForInstagram } from '@/lib/instagram/media'

export async function executePublishStep(context: PipelineContext): Promise<StepResult> {
  const { influencerId, scheduledPostIds = [] } = context

  // Vérifier si le compte Instagram est connecté
  const instagramAccount = await prisma.instagramAccount.findUnique({
    where: { influencerId }
  })

  if (!instagramAccount || !instagramAccount.isConnected) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Compte Instagram non connecté'
    }
  }

  // Vérifier si le token n'est pas expiré
  if (instagramAccount.accessTokenExpiresAt < new Date()) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Token Instagram expiré - reconnexion nécessaire'
    }
  }

  // Chercher les posts à publier maintenant
  const now = new Date()
  const posts = await prisma.scheduledPost.findMany({
    where: {
      influencerId,
      status: 'scheduled',
      scheduledFor: {
        lte: now
      }
    },
    orderBy: { scheduledFor: 'asc' },
    take: 5 // Limiter pour éviter les rate limits
  })

  if (posts.length === 0) {
    return {
      success: true,
      skipped: true,
      skipReason: 'Aucun post à publier maintenant'
    }
  }

  console.log(`[Publish] Publishing ${posts.length} posts for influencer ${influencerId}`)

  const published: string[] = []
  const failed: string[] = []

  for (const post of posts) {
    try {
      // Marquer comme en cours de publication
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'publishing' }
      })

      // Préparer l'image (upload temporaire)
      const imageUrl = await prepareImageForInstagram(post.imageData)

      // Construire la caption complète avec hashtags
      const fullCaption = post.hashtags.length > 0
        ? `${post.caption}\n\n${post.hashtags.join(' ')}`
        : post.caption

      let result

      if (post.isCarousel && post.carouselImages.length > 0) {
        // Préparer toutes les images du carousel
        const imageUrls = [imageUrl]
        for (const img of post.carouselImages) {
          imageUrls.push(await prepareImageForInstagram(img))
        }
        result = await publishCarousel(influencerId, imageUrls, fullCaption)
      } else {
        result = await publishSingleImage(influencerId, imageUrl, fullCaption)
      }

      if (result.success) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            instagramPostId: result.postId,
            instagramUrl: result.postUrl
          }
        })
        published.push(post.id)
        console.log(`[Publish] Successfully published post ${post.id}`)
      } else {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: result.error
          }
        })
        failed.push(post.id)
        console.log(`[Publish] Failed to publish post ${post.id}: ${result.error}`)
      }

      // Délai entre les publications (rate limit Instagram)
      await new Promise(resolve => setTimeout(resolve, 10000))
    } catch (error) {
      console.error(`[Publish] Error publishing post ${post.id}:`, error)
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      failed.push(post.id)
    }
  }

  return {
    success: true,
    data: {
      published: published.length,
      failed: failed.length,
      total: posts.length
    }
  }
}
