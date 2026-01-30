import { NextRequest, NextResponse } from 'next/server'
import { getInfluencers, createInfluencer, getInfluencerByHandle } from '@/lib/influencer'

/**
 * GET /api/influencers
 * Récupère la liste de toutes les influenceuses
 */
export async function GET() {
  try {
    const influencers = await getInfluencers()
    return NextResponse.json(influencers)
  } catch (error) {
    console.error('Error fetching influencers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch influencers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/influencers
 * Crée une nouvelle influenceuse
 * Body: { name: string, handle: string, avatarData?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation des champs requis
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!body.handle || typeof body.handle !== 'string' || body.handle.trim() === '') {
      return NextResponse.json(
        { error: 'Handle is required' },
        { status: 400 }
      )
    }

    // Normaliser le handle
    const handle = body.handle.trim().startsWith('@')
      ? body.handle.trim()
      : `@${body.handle.trim()}`

    // Vérifier que le handle n'existe pas déjà
    const existing = await getInfluencerByHandle(handle)
    if (existing) {
      return NextResponse.json(
        { error: 'Handle already exists' },
        { status: 409 }
      )
    }

    // Créer l'influenceuse
    const influencer = await createInfluencer({
      name: body.name.trim(),
      handle,
      avatarData: body.avatarData || undefined
    })

    return NextResponse.json(influencer, { status: 201 })
  } catch (error) {
    console.error('Error creating influencer:', error)
    return NextResponse.json(
      { error: 'Failed to create influencer' },
      { status: 500 }
    )
  }
}
