import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishSingleImage, publishCarousel } from '@/lib/instagram/publish'
import { prepareImageForInstagram } from '@/lib/instagram/media'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/scheduled-posts/[id]/publish
 * Publie immédiatement un post programmé (bypass le cron)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Récupérer le post
    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        influencer: {
          include: {
            instagramAccount: true
          }
        }
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post non trouvé' },
        { status: 404 }
      )
    }

    // Vérifier le statut
    if (post.status === 'published') {
      return NextResponse.json(
        { error: 'Ce post a déjà été publié' },
        { status: 400 }
      )
    }

    if (post.status === 'publishing') {
      return NextResponse.json(
        { error: 'Ce post est en cours de publication' },
        { status: 400 }
      )
    }

    // Vérifier le compte Instagram
    if (!post.influencer.instagramAccount) {
      return NextResponse.json(
        { error: 'Aucun compte Instagram connecté pour cette influenceuse' },
        { status: 400 }
      )
    }

    if (!post.influencer.instagramAccount.isConnected) {
      return NextResponse.json(
        { error: 'Le compte Instagram n\'est plus connecté' },
        { status: 400 }
      )
    }

    // Vérifier l'expiration du token
    if (new Date(post.influencer.instagramAccount.accessTokenExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Le token Instagram a expiré. Veuillez reconnecter le compte.' },
        { status: 400 }
      )
    }

    // Marquer le post comme en cours de publication
    await prisma.scheduledPost.update({
      where: { id },
      data: { status: 'publishing' }
    })

    try {
      // Construire la caption avec hashtags
      const fullCaption = post.hashtags.length > 0
        ? `${post.caption}\n\n${post.hashtags.join(' ')}`
        : post.caption

      // Préparer les images
      if (post.isCarousel && post.carouselImages.length > 0) {
        // Carrousel
        const imageUrls = await Promise.all([
          prepareImageForInstagram(post.imageData),
          ...post.carouselImages.map(img => prepareImageForInstagram(img))
        ])

        const result = await publishCarousel(
          post.influencerId,
          imageUrls,
          fullCaption
        )

        if (!result.success) {
          throw new Error(result.error || 'Échec de la publication du carrousel')
        }

        // Mise à jour du post
        await prisma.scheduledPost.update({
          where: { id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            instagramPostId: result.postId,
            instagramUrl: result.postUrl
          }
        })

        return NextResponse.json({
          success: true,
          instagramPostId: result.postId,
          instagramUrl: result.postUrl
        })
      } else {
        // Image unique
        const imageUrl = await prepareImageForInstagram(post.imageData)

        const result = await publishSingleImage(
          post.influencerId,
          imageUrl,
          fullCaption
        )

        if (!result.success) {
          throw new Error(result.error || 'Échec de la publication')
        }

        // Mise à jour du post
        await prisma.scheduledPost.update({
          where: { id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            instagramPostId: result.postId,
            instagramUrl: result.postUrl
          }
        })

        return NextResponse.json({
          success: true,
          instagramPostId: result.postId,
          instagramUrl: result.postUrl
        })
      }
    } catch (error) {
      // En cas d'erreur, marquer comme failed
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'

      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage
        }
      })

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error publishing post:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la publication' },
      { status: 500 }
    )
  }
}
