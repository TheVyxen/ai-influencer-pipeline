import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/approved
 * Liste les photos approuvées (prêtes pour la description/génération)
 * @param influencerId - Optionnel, filtre par influenceur
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')

    const photos = await prisma.sourcePhoto.findMany({
      where: {
        status: 'approved',
        // Filtrer par influenceur via la relation Source
        ...(influencerId && {
          source: { influencerId }
        })
      },
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
