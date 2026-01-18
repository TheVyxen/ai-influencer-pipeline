import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/sources
 * Liste toutes les sources Instagram
 */
export async function GET() {
  try {
    const sources = await prisma.source.findMany({
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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

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

    // Vérifier si la source existe déjà
    const existing = await prisma.source.findUnique({
      where: { username: cleanUsername }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Source already exists' },
        { status: 409 }
      )
    }

    const source = await prisma.source.create({
      data: { username: cleanUsername }
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
