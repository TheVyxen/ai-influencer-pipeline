import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Force dynamic pour éviter le pré-rendu (données trop volumineuses)
export const dynamic = 'force-dynamic'

/**
 * GET /api/photos/generated
 * Liste toutes les photos générées
 */
export async function GET() {
  try {
    const photos = await prisma.generatedPhoto.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourcePhoto: {
          select: {
            id: true,
            source: {
              select: { username: true }
            }
          }
        }
      }
    })

    // Transformer les dates en ISO string pour le client
    const photosData = photos.map(p => ({
      id: p.id,
      prompt: p.prompt,
      localPath: p.localPath,
      createdAt: p.createdAt.toISOString(),
      isCarousel: p.isCarousel,
      carouselId: p.carouselId,
      carouselIndex: p.carouselIndex,
      carouselTotal: p.carouselTotal,
      sourcePhoto: p.sourcePhoto
    }))

    return NextResponse.json(photosData)
  } catch (error) {
    console.error('Error fetching generated photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generated photos' },
      { status: 500 }
    )
  }
}
