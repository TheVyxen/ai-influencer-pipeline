/**
 * Middleware Next.js pour protéger l'application par mot de passe
 * Redirige vers /login si l'utilisateur n'est pas authentifié
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Nom du cookie d'authentification
const AUTH_COOKIE = 'auth-token'

// Routes publiques (ne nécessitent pas d'authentification)
const PUBLIC_ROUTES = ['/login', '/api/auth']

// Extensions de fichiers statiques à ignorer
const STATIC_EXTENSIONS = ['.ico', '.png', '.jpg', '.jpeg', '.svg', '.css', '.js', '.woff', '.woff2']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorer les fichiers statiques
  if (STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
    return NextResponse.next()
  }

  // Ignorer les routes Next.js internes
  if (pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // Ignorer les routes publiques
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Vérifier le cookie d'authentification
  const authToken = request.cookies.get(AUTH_COOKIE)?.value

  if (!authToken) {
    // Pas de token, rediriger vers login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Vérification simple de la présence du token
  // La vérification complète se fait côté serveur dans les API routes
  // Le middleware ne peut pas utiliser crypto de Node.js (Edge Runtime)

  // Token présent, vérifier sa structure basique (base64 valide)
  try {
    const decoded = atob(authToken)
    if (!decoded.includes('authenticated:') || !decoded.includes('.')) {
      throw new Error('Invalid token format')
    }
  } catch {
    // Token invalide, rediriger vers login
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    // Supprimer le cookie invalide
    response.cookies.delete(AUTH_COOKIE)
    return response
  }

  return NextResponse.next()
}

// Configuration du middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
