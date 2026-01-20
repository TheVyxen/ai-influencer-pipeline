import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    return NextResponse.json(photos)
  } catch (error) {
    console.error('Error fetching generated photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generated photos' },
      { status: 500 }
    )
  }
}
