import { NextResponse } from 'next/server'

// Nom du cookie d'authentification
const AUTH_COOKIE = 'auth-token'

/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur en supprimant le cookie
 */
export async function POST() {
  const response = NextResponse.json({ success: true })

  // Supprimer le cookie en le définissant avec une date d'expiration passée
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
