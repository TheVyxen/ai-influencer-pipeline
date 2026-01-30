/**
 * Service Wavespeed pour la génération img2img
 * Modèle : google/nano-banana-pro/edit
 * Alternative à Gemini en cas de surcharge
 *
 * IMPORTANT: Wavespeed nécessite des URLs publiques pour les images
 * L'app doit être déployée et NEXT_PUBLIC_APP_URL configuré
 *
 * L'image de référence est servie via /api/images/reference (stockée en base64 dans la DB)
 */

import prisma from './prisma'

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit'

/**
 * Types d'erreurs possibles
 */
export class WavespeedError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'NOT_DEPLOYED' | 'RATE_LIMIT' | 'API_ERROR' | 'TIMEOUT' | 'GENERATION_FAILED' | 'NO_OUTPUT' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'WavespeedError'
  }
}

/**
 * Interface pour la réponse de l'API Wavespeed
 */
interface WavespeedResponse {
  code: number
  message: string
  data: {
    id: string
    status: 'created' | 'processing' | 'completed' | 'failed'
    outputs: string[]
    error?: string
  }
}

/**
 * Récupère la clé API Wavespeed (depuis env ou Settings)
 */
async function getApiKey(): Promise<string | null> {
  // D'abord vérifier les variables d'environnement
  if (process.env.WAVESPEED_API_KEY) {
    return process.env.WAVESPEED_API_KEY
  }

  // Sinon chercher dans les Settings
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: 'wavespeed_api_key' }
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * Vérifie si Wavespeed est configuré (clé API + app déployée)
 */
export async function isWavespeedConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  return Boolean(apiKey && apiKey.length > 0 && appUrl && appUrl.length > 0)
}

/**
 * Vérifie si l'app est déployée (NEXT_PUBLIC_APP_URL configuré)
 */
export function isAppDeployed(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  return Boolean(appUrl && appUrl.length > 0)
}

/**
 * Génère une image via Wavespeed API (google/nano-banana-pro/edit)
 * @param referenceImagePath - Chemin relatif de l'image de référence (ex: "/reference/model.jpg")
 * @param prompt - Le prompt de génération
 * @param aspectRatio - Format d'image (9:16, 1:1, 16:9, 3:2, 2:3, etc.) - défaut: 9:16
 * @param outputFormat - Format de sortie (jpeg, png) - défaut: png
 * @returns Buffer de l'image générée
 */
export async function generateImageWithWavespeed(
  referenceImagePath: string,
  prompt: string,
  aspectRatio: string = '9:16',
  outputFormat: string = 'png'
): Promise<Buffer> {
  const apiKey = await getApiKey()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!apiKey) {
    throw new WavespeedError(
      'Configurez votre clé Wavespeed API dans Settings',
      'NOT_CONFIGURED'
    )
  }

  if (!appUrl) {
    throw new WavespeedError(
      'Wavespeed nécessite que l\'app soit déployée. En local, utilisez Gemini.',
      'NOT_DEPLOYED'
    )
  }

  // Construire l'URL publique de l'image de référence
  const referenceImageUrl = `${appUrl}${referenceImagePath}`

  try {
    console.log('Wavespeed generation starting...')
    console.log(`Reference image URL: ${referenceImageUrl}`)

    const response = await fetch(WAVESPEED_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        images: [referenceImageUrl],
        aspect_ratio: aspectRatio,
        output_format: outputFormat,
        enable_sync_mode: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      if (response.status === 429) {
        throw new WavespeedError(
          'Trop de requêtes Wavespeed, réessayez dans quelques secondes',
          'RATE_LIMIT'
        )
      }

      if (response.status === 401 || response.status === 403) {
        throw new WavespeedError(
          'Clé API Wavespeed invalide',
          'NOT_CONFIGURED'
        )
      }

      throw new WavespeedError(
        `Erreur Wavespeed: ${response.status} - ${errorData.message || errorData.error || JSON.stringify(errorData)}`,
        'API_ERROR'
      )
    }

    const result: WavespeedResponse = await response.json()

    // Vérifier le statut de la génération
    if (result.data.status === 'failed') {
      throw new WavespeedError(
        `Échec de la génération: ${result.data.error || 'Erreur inconnue'}`,
        'GENERATION_FAILED'
      )
    }

    // Vérifier qu'on a une image en sortie
    if (!result.data.outputs || result.data.outputs.length === 0) {
      throw new WavespeedError(
        'Aucune image générée par Wavespeed',
        'NO_OUTPUT'
      )
    }

    // Télécharger l'image générée
    const outputUrl = result.data.outputs[0]
    console.log(`Downloading generated image from: ${outputUrl}`)

    const imageResponse = await fetch(outputUrl)
    if (!imageResponse.ok) {
      throw new WavespeedError(
        'Impossible de télécharger l\'image générée',
        'GENERATION_FAILED'
      )
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    console.log('Wavespeed generation completed successfully')
    return Buffer.from(arrayBuffer)

  } catch (error) {
    // Propager les erreurs Wavespeed telles quelles
    if (error instanceof WavespeedError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('rate')) {
      throw new WavespeedError(
        'Trop de requêtes Wavespeed, réessayez dans quelques secondes',
        'RATE_LIMIT'
      )
    }

    // Timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new WavespeedError(
        'La génération Wavespeed prend trop de temps, réessayez',
        'TIMEOUT'
      )
    }

    // Erreur de connexion
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      throw new WavespeedError(
        'Erreur de connexion à Wavespeed',
        'API_ERROR'
      )
    }

    // Erreur générique
    throw new WavespeedError(
      `Erreur lors de la génération Wavespeed: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}
