/**
 * Fonctions d'authentification pour l'application
 * Utilise HMAC SHA256 pour signer les tokens
 */

import { createHmac } from 'crypto'

// Durée de validité du token (7 jours)
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000

/**
 * Récupère la clé secrète pour signer les tokens
 */
function getSecret(): string {
  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error('APP_SECRET non configuré')
  }
  return secret
}

/**
 * Crée une signature HMAC SHA256
 */
function createSignature(data: string): string {
  return createHmac('sha256', getSecret())
    .update(data)
    .digest('hex')
}

/**
 * Crée un token signé avec une date d'expiration
 */
export function signToken(): string {
  const expiry = Date.now() + TOKEN_EXPIRY
  const data = `authenticated:${expiry}`
  const signature = createSignature(data)

  // Format: data.signature (encodé en base64 pour le cookie)
  const token = Buffer.from(`${data}.${signature}`).toString('base64')
  return token
}

/**
 * Vérifie si un token est valide et non expiré
 */
export function verifyToken(token: string): boolean {
  try {
    // Décoder le token
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [data, signature] = decoded.split('.')

    if (!data || !signature) {
      return false
    }

    // Vérifier la signature
    const expectedSignature = createSignature(data)
    if (signature !== expectedSignature) {
      return false
    }

    // Vérifier l'expiration
    const [, expiryStr] = data.split(':')
    const expiry = parseInt(expiryStr, 10)

    if (isNaN(expiry) || Date.now() > expiry) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Vérifie si le mot de passe est correct
 */
export function verifyPassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    console.error('APP_PASSWORD non configuré')
    return false
  }
  return password === appPassword
}
