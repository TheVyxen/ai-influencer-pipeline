import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/approved
 * Liste les photos approuvées (prêtes pour la description/génération)
 */
export async function GET() {
  try {
    const photos = await prisma.sourcePhoto.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      include: {
        source: {
          select: { username: true }
        }
      }
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('Error fetching approved photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approved photos' },
      { status: 500 }
    )
  }
}
