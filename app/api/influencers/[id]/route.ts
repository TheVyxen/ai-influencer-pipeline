import { NextRequest, NextResponse } from 'next/server'
import {
  getInfluencerById,
  updateInfluencer,
  deleteInfluencer,
  getInfluencerByHandle
} from '@/lib/influencer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/influencers/[id]
 * Récupère une influenceuse par son ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const influencer = await getInfluencerById(id)

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(influencer)
  } catch (error) {
    console.error('Error fetching influencer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch influencer' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/influencers/[id]
 * Met à jour une influenceuse
 * Body: { name?, handle?, avatarData?, isActive?, agentEnabled?, agentInterval? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier que l'influenceuse existe
    const existing = await getInfluencerById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    // Si le handle change, vérifier qu'il n'existe pas déjà
    if (body.handle && body.handle !== existing.handle) {
      const normalizedHandle = body.handle.startsWith('@')
        ? body.handle
        : `@${body.handle}`

      const handleExists = await getInfluencerByHandle(normalizedHandle)
      if (handleExists && handleExists.id !== id) {
        return NextResponse.json(
          { error: 'Handle already exists' },
          { status: 409 }
        )
      }
    }

    // Mettre à jour l'influenceuse
    const influencer = await updateInfluencer(id, body)

    return NextResponse.json(influencer)
  } catch (error) {
    console.error('Error updating influencer:', error)
    return NextResponse.json(
      { error: 'Failed to update influencer' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/influencers/[id]
 * Supprime une influenceuse et toutes ses données associées
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Vérifier que l'influenceuse existe
    const existing = await getInfluencerById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    await deleteInfluencer(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting influencer:', error)
    return NextResponse.json(
      { error: 'Failed to delete influencer' },
      { status: 500 }
    )
  }
}
