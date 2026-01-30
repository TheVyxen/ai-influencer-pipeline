/**
 * Service OAuth pour Instagram/Meta Graph API
 * Gestion des tokens d'accès pour la publication
 */

import prisma from '@/lib/prisma'
import crypto from 'crypto'

// Variables d'environnement requises
const CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID
const CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`
  : 'http://localhost:3000/api/instagram/callback'

// Algorithme de chiffrement
const ALGORITHM = 'aes-256-gcm'

/**
 * Chiffre une chaîne (pour stocker les tokens)
 */
export function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Déchiffre une chaîne
 */
export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Génère l'URL d'autorisation OAuth Instagram
 */
export function getAuthorizationUrl(influencerId: string): string {
  if (!CLIENT_ID) {
    throw new Error('INSTAGRAM_CLIENT_ID not configured')
  }

  const state = Buffer.from(JSON.stringify({ influencerId })).toString('base64')

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights',
    response_type: 'code',
    state
  })

  return `https://api.instagram.com/oauth/authorize?${params}`
}

/**
 * Échange le code d'autorisation contre un access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  userId: string
}> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Instagram OAuth not configured')
  }

  // Étape 1: Obtenir un short-lived token
  const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code
    })
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to exchange code: ${error}`)
  }

  const tokenData = await tokenResponse.json()

  // Étape 2: Échanger contre un long-lived token (60 jours)
  const longLivedResponse = await fetch(
    `https://graph.instagram.com/access_token?` +
    `grant_type=ig_exchange_token&` +
    `client_secret=${CLIENT_SECRET}&` +
    `access_token=${tokenData.access_token}`
  )

  if (!longLivedResponse.ok) {
    // Utiliser le short-lived token si l'échange échoue
    return {
      accessToken: tokenData.access_token,
      userId: tokenData.user_id.toString()
    }
  }

  const longLivedData = await longLivedResponse.json()

  return {
    accessToken: longLivedData.access_token,
    userId: tokenData.user_id.toString()
  }
}

/**
 * Rafraîchit un long-lived token (avant expiration)
 */
export async function refreshToken(accessToken: string): Promise<{
  accessToken: string
  expiresIn: number
}> {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
    `grant_type=ig_refresh_token&` +
    `access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  }
}

/**
 * Récupère les informations du compte Instagram
 */
export async function getAccountInfo(accessToken: string): Promise<{
  id: string
  username: string
  accountType: string
}> {
  const response = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get account info: ${error}`)
  }

  const data = await response.json()

  return {
    id: data.id,
    username: data.username,
    accountType: data.account_type
  }
}

/**
 * Sauvegarde les credentials Instagram pour une influenceuse
 */
export async function saveInstagramAccount(
  influencerId: string,
  accessToken: string,
  userId: string,
  username: string,
  accountType: string
): Promise<void> {
  const encryptedToken = encrypt(accessToken)
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 jours

  await prisma.instagramAccount.upsert({
    where: { influencerId },
    create: {
      influencerId,
      instagramUserId: userId,
      instagramUsername: username,
      instagramAccountType: accountType,
      accessToken: encryptedToken,
      accessTokenExpiresAt: expiresAt,
      isConnected: true
    },
    update: {
      instagramUserId: userId,
      instagramUsername: username,
      instagramAccountType: accountType,
      accessToken: encryptedToken,
      accessTokenExpiresAt: expiresAt,
      isConnected: true,
      errorMessage: null
    }
  })
}

/**
 * Récupère et déchiffre le token d'accès d'une influenceuse
 */
export async function getDecryptedToken(influencerId: string): Promise<string | null> {
  const account = await prisma.instagramAccount.findUnique({
    where: { influencerId }
  })

  if (!account || !account.isConnected) {
    return null
  }

  // Vérifier l'expiration
  if (account.accessTokenExpiresAt < new Date()) {
    // Token expiré, marquer comme déconnecté
    await prisma.instagramAccount.update({
      where: { influencerId },
      data: {
        isConnected: false,
        errorMessage: 'Token expiré'
      }
    })
    return null
  }

  return decrypt(account.accessToken)
}

/**
 * Déconnecte le compte Instagram
 */
export async function disconnectAccount(influencerId: string): Promise<void> {
  await prisma.instagramAccount.delete({
    where: { influencerId }
  }).catch(() => {
    // Ignorer si le compte n'existe pas
  })
}
