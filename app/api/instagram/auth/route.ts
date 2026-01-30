import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/instagram/oauth'
import prisma from '@/lib/prisma'

/**
 * GET /api/instagram/auth?influencerId=xxx
 * Redirige vers l'écran d'autorisation Instagram OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')

    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      )
    }

    // Vérifier que l'influenceuse existe
    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId }
    })

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    // Vérifier si les credentials Instagram sont configurés
    if (!process.env.INSTAGRAM_CLIENT_ID || !process.env.INSTAGRAM_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Instagram OAuth not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET.' },
        { status: 500 }
      )
    }

    // Générer l'URL d'autorisation
    const authUrl = getAuthorizationUrl(influencerId)

    // Rediriger vers Instagram
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error initiating Instagram auth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Instagram authorization' },
      { status: 500 }
    )
  }
}
