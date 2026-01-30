import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/sources
 * Liste les sources Instagram
 * @param influencerId - Optionnel, filtre par influenceur
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')

    const sources = await prisma.source.findMany({
      where: influencerId ? { influencerId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { photos: true }
        }
      }
    })

    return NextResponse.json(sources)
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sources
 * Ajouter une nouvelle source Instagram
 * @param influencerId - Requis, l'influenceur propriétaire de la source
 * @param username - Requis, le nom d'utilisateur Instagram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, influencerId } = body

    if (!influencerId || typeof influencerId !== 'string') {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      )
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Nettoyer le username (enlever @ si présent)
    const cleanUsername = username.replace(/^@/, '').trim()

    if (cleanUsername.length === 0) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      )
    }

    // Vérifier si la source existe déjà pour cet influenceur
    const existing = await prisma.source.findFirst({
      where: {
        influencerId,
        username: cleanUsername
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Source already exists for this influencer' },
        { status: 409 }
      )
    }

    const source = await prisma.source.create({
      data: {
        username: cleanUsername,
        influencerId
      }
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    console.error('Error creating source:', error)
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    )
  }
}
