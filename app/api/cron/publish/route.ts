import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishSingleImage, publishCarousel } from '@/lib/instagram/publish'
import { prepareImageForInstagram } from '@/lib/instagram/media'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/publish
 * Cron job pour publier les posts programmés
 * Devrait être appelé toutes les 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret pour sécuriser l'endpoint
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Récupérer les posts à publier
    const posts = await prisma.scheduledPost.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: {
          lte: now
        }
      },
      include: {
        influencer: {
          include: {
            instagramAccount: true
          }
        }
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10 // Limiter pour éviter les timeouts
    })

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts to publish',
        published: 0
      })
    }

    const results = {
      published: [] as string[],
      failed: [] as string[],
      skipped: [] as string[]
    }

    for (const post of posts) {
      // Vérifier si le compte Instagram est connecté
      if (!post.influencer.instagramAccount?.isConnected) {
        results.skipped.push(`${post.id} (Instagram not connected)`)
        continue
      }

      // Vérifier si le token n'est pas expiré
      if (post.influencer.instagramAccount.accessTokenExpiresAt < now) {
        results.skipped.push(`${post.id} (token expired)`)
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: 'Token Instagram expiré'
          }
        })
        continue
      }

      try {
        // Marquer comme en cours
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: 'publishing' }
        })

        // Préparer l'image
        const imageUrl = await prepareImageForInstagram(post.imageData)

        // Construire la caption
        const fullCaption = post.hashtags.length > 0
          ? `${post.caption}\n\n${post.hashtags.join(' ')}`
          : post.caption

        let result

        if (post.isCarousel && post.carouselImages.length > 0) {
          const imageUrls = [imageUrl]
          for (const img of post.carouselImages) {
            imageUrls.push(await prepareImageForInstagram(img))
          }
          result = await publishCarousel(post.influencerId, imageUrls, fullCaption)
        } else {
          result = await publishSingleImage(post.influencerId, imageUrl, fullCaption)
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
          results.published.push(post.id)
        } else {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: 'failed',
              errorMessage: result.error
            }
          })
          results.failed.push(`${post.id} (${result.error})`)
        }

        // Délai entre les publications
        await new Promise(resolve => setTimeout(resolve, 10000))
      } catch (error) {
        console.error(`[Cron Publish] Error publishing post ${post.id}:`, error)
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        results.failed.push(post.id)
      }
    }

    return NextResponse.json({
      success: true,
      published: results.published.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      details: results
    })
  } catch (error) {
    console.error('[Cron Publish] Error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
