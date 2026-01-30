import { NextRequest, NextResponse } from 'next/server'
import { disconnectAccount } from '@/lib/instagram/oauth'
import prisma from '@/lib/prisma'

/**
 * POST /api/instagram/disconnect
 * Déconnecte le compte Instagram d'une influenceuse
 * Body: { influencerId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { influencerId } = body

    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      )
    }

    // Vérifier que l'influenceuse existe
    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      include: { instagramAccount: true }
    })

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    if (!influencer.instagramAccount) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      )
    }

    // Déconnecter le compte
    await disconnectAccount(influencerId)

    console.log(`[Instagram] Account disconnected for influencer ${influencerId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Instagram:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Instagram account' },
      { status: 500 }
    )
  }
}
