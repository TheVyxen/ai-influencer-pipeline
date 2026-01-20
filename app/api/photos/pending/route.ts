import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/pending
 * Liste les photos en attente de validation
 */
export async function GET() {
  try {
    const photos = await prisma.sourcePhoto.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        source: {
          select: { username: true }
        }
      }
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('Error fetching pending photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending photos' },
      { status: 500 }
    )
  }
}
