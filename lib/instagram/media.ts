/**
 * Service de gestion des médias pour Instagram
 * Upload temporaire d'images vers une URL publique
 */

import prisma from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Génère une URL publique temporaire pour une image base64
 * Stocke l'image dans la DB avec un token unique
 * L'image sera accessible via /api/media/[token]
 */
export async function createTemporaryImageUrl(
  imageBase64: string,
  expiresInMinutes: number = 30
): Promise<string> {
  // Générer un token unique
  const token = `img_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

  // Stocker dans AppSettings avec expiration (utilisation temporaire)
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  await prisma.appSettings.create({
    data: {
      key: `temp_image_${token}`,
      value: JSON.stringify({
        imageData: imageBase64,
        expiresAt: expiresAt.toISOString()
      })
    }
  })

  return `${APP_URL}/api/media/${token}`
}

/**
 * Récupère une image temporaire par son token
 */
export async function getTemporaryImage(token: string): Promise<string | null> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: `temp_image_${token}` }
  })

  if (!setting) {
    return null
  }

  try {
    const data = JSON.parse(setting.value)

    // Vérifier l'expiration
    if (new Date(data.expiresAt) < new Date()) {
      // Supprimer l'image expirée
      await prisma.appSettings.delete({
        where: { key: `temp_image_${token}` }
      }).catch(() => {})
      return null
    }

    return data.imageData
  } catch {
    return null
  }
}

/**
 * Supprime une image temporaire
 */
export async function deleteTemporaryImage(token: string): Promise<void> {
  await prisma.appSettings.delete({
    where: { key: `temp_image_${token}` }
  }).catch(() => {})
}

/**
 * Nettoie les images temporaires expirées
 */
export async function cleanupExpiredImages(): Promise<number> {
  const tempImages = await prisma.appSettings.findMany({
    where: {
      key: {
        startsWith: 'temp_image_'
      }
    }
  })

  let deletedCount = 0
  const now = new Date()

  for (const image of tempImages) {
    try {
      const data = JSON.parse(image.value)
      if (new Date(data.expiresAt) < now) {
        await prisma.appSettings.delete({
          where: { key: image.key }
        })
        deletedCount++
      }
    } catch {
      // Supprimer les entrées corrompues
      await prisma.appSettings.delete({
        where: { key: image.key }
      }).catch(() => {})
      deletedCount++
    }
  }

  return deletedCount
}

/**
 * Prépare une image base64 pour publication Instagram
 * Retourne une URL publique temporaire
 */
export async function prepareImageForInstagram(imageBase64: string): Promise<string> {
  // Nettoyer le préfixe data: si présent
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  // Créer l'URL temporaire (valide 30 minutes)
  return createTemporaryImageUrl(cleanBase64, 30)
}
