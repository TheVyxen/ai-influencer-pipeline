import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Force dynamic pour éviter le cache
export const dynamic = 'force-dynamic'

/**
 * GET /api/photos/pending
 * Liste les photos en attente de validation
 * Triées par date de publication Instagram (plus récent en premier)
 */
export async function GET() {
  try {
    const photos = await prisma.sourcePhoto.findMany({
      where: { status: 'pending' },
      // Trier par date de publication Instagram, fallback sur createdAt
      orderBy: [
        { instagramPublishedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' }
      ],
      include: {
        source: {
          select: { username: true }
        }
      }
    })

    // Transformer les dates en ISO string pour le client
    const photosData = photos.map(p => ({
      id: p.id,
      originalUrl: p.originalUrl,
      localPath: p.localPath,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      instagramPostUrl: p.instagramPostUrl,
      instagramPublishedAt: p.instagramPublishedAt?.toISOString() || null,
      isCarousel: p.isCarousel,
      carouselId: p.carouselId,
      carouselIndex: p.carouselIndex,
      carouselTotal: p.carouselTotal,
      source: p.source
    }))

    return NextResponse.json(photosData)
  } catch (error) {
    console.error('Error fetching pending photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending photos' },
      { status: 500 }
    )
  }
}
