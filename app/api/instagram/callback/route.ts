import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForToken,
  getAccountInfo,
  saveInstagramAccount
} from '@/lib/instagram/oauth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/instagram/callback
 * Callback OAuth Instagram - échange le code contre un token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorReason = searchParams.get('error_reason')
    const errorDescription = searchParams.get('error_description')

    // Gérer les erreurs OAuth
    if (error) {
      console.error('Instagram OAuth error:', { error, errorReason, errorDescription })
      return NextResponse.redirect(
        `${APP_URL}/influencers?error=instagram_auth_failed&message=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${APP_URL}/influencers?error=missing_params`
      )
    }

    // Décoder le state pour récupérer l'influencerId
    let influencerId: string

    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      influencerId = stateData.influencerId
    } catch {
      return NextResponse.redirect(
        `${APP_URL}/influencers?error=invalid_state`
      )
    }

    if (!influencerId) {
      return NextResponse.redirect(
        `${APP_URL}/influencers?error=missing_influencer_id`
      )
    }

    // Échanger le code contre un token
    const { accessToken, userId } = await exchangeCodeForToken(code)

    // Récupérer les infos du compte Instagram
    const accountInfo = await getAccountInfo(accessToken)

    // Sauvegarder en base de données
    await saveInstagramAccount(
      influencerId,
      accessToken,
      userId,
      accountInfo.username,
      accountInfo.accountType
    )

    console.log(`[Instagram] Account connected for influencer ${influencerId}: @${accountInfo.username}`)

    // Rediriger vers la page de l'influenceuse
    return NextResponse.redirect(
      `${APP_URL}/influencers/${influencerId}?instagram=connected`
    )
  } catch (error) {
    console.error('Error in Instagram callback:', error)
    return NextResponse.redirect(
      `${APP_URL}/influencers?error=callback_failed&message=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error'
      )}`
    )
  }
}
