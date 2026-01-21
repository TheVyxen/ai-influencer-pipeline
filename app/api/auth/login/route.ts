import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyPassword } from '@/lib/auth'

// Nom du cookie d'authentification
const AUTH_COOKIE = 'auth-token'

// Durée du cookie (7 jours)
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

/**
 * POST /api/auth/login
 * Authentifie l'utilisateur avec un mot de passe
 * Body: { password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Mot de passe requis' },
        { status: 400 }
      )
    }

    // Vérifier si APP_PASSWORD est configuré
    if (!process.env.APP_PASSWORD) {
      return NextResponse.json(
        { error: 'APP_PASSWORD non configuré sur le serveur' },
        { status: 500 }
      )
    }

    // Vérifier si APP_SECRET est configuré
    if (!process.env.APP_SECRET) {
      return NextResponse.json(
        { error: 'APP_SECRET non configuré sur le serveur' },
        { status: 500 }
      )
    }

    // Vérifier le mot de passe
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Créer le token signé
    const token = signToken()

    // Créer la réponse avec le cookie
    const response = NextResponse.json({ success: true })

    // Définir le cookie
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la connexion' },
      { status: 500 }
    )
  }
}
