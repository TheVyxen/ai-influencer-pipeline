import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/scheduled-posts
 * Récupère les posts programmés
 * Query params:
 *   - influencerId: Filtrer par influenceuse
 *   - status: Filtrer par statut (scheduled, publishing, published, failed)
 *   - from: Date de début (ISO string)
 *   - to: Date de fin (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Construire le filtre
    const where: Record<string, unknown> = {}

    if (influencerId) {
      where.influencerId = influencerId
    }

    if (status) {
      where.status = status
    }

    if (from || to) {
      where.scheduledFor = {}
      if (from) {
        (where.scheduledFor as Record<string, Date>).gte = new Date(from)
      }
      if (to) {
        (where.scheduledFor as Record<string, Date>).lte = new Date(to)
      }
    }

    const posts = await prisma.scheduledPost.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: {
        influencer: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarData: true
          }
        },
        generatedPhoto: {
          select: {
            id: true,
            prompt: true
          }
        }
      }
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching scheduled posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled posts', posts: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scheduled-posts
 * Crée un nouveau post programmé
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      influencerId,
      generatedPhotoId,
      imageData,
      caption,
      hashtags = [],
      isCarousel = false,
      carouselImages = [],
      scheduledFor
    } = body

    if (!influencerId || !imageData || !caption || !scheduledFor) {
      return NextResponse.json(
        { error: 'Missing required fields: influencerId, imageData, caption, scheduledFor' },
        { status: 400 }
      )
    }

    const post = await prisma.scheduledPost.create({
      data: {
        influencerId,
        generatedPhotoId,
        imageData,
        caption,
        hashtags,
        isCarousel,
        carouselImages,
        scheduledFor: new Date(scheduledFor),
        status: 'scheduled'
      }
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Error creating scheduled post:', error)
    return NextResponse.json(
      { error: 'Failed to create scheduled post' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/scheduled-posts
 * Met à jour un post programmé
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, publishedAt, instagramPostId, instagramUrl, errorMessage, scheduledFor, caption, hashtags } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing post id' },
        { status: 400 }
      )
    }

    // Vérifier que le post existe
    const existing = await prisma.scheduledPost.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (status) updateData.status = status
    if (publishedAt) updateData.publishedAt = new Date(publishedAt)
    if (instagramPostId) updateData.instagramPostId = instagramPostId
    if (instagramUrl) updateData.instagramUrl = instagramUrl
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage
    if (scheduledFor) updateData.scheduledFor = new Date(scheduledFor)
    if (caption) updateData.caption = caption
    if (hashtags) updateData.hashtags = hashtags

    const post = await prisma.scheduledPost.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Error updating scheduled post:', error)
    return NextResponse.json(
      { error: 'Failed to update scheduled post' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scheduled-posts
 * Supprime un post programmé
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing post id' },
        { status: 400 }
      )
    }

    await prisma.scheduledPost.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scheduled post:', error)
    return NextResponse.json(
      { error: 'Failed to delete scheduled post' },
      { status: 500 }
    )
  }
}
