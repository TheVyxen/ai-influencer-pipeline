/**
 * Service Wavespeed pour la génération img2img
 * Modèle : google/nano-banana-pro/edit
 * Alternative à Gemini en cas de surcharge
 */

import prisma from './prisma'

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/google/nano-banana-pro/edit'

/**
 * Types d'erreurs possibles
 */
export class WavespeedError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'RATE_LIMIT' | 'API_ERROR' | 'TIMEOUT' | 'GENERATION_FAILED' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'WavespeedError'
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
    const setting = await prisma.settings.findUnique({
      where: { key: 'wavespeed_api_key' }
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * Vérifie si Wavespeed est configuré
 */
export async function isWavespeedConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  return Boolean(apiKey && apiKey.length > 0)
}

/**
 * Génère une image via Wavespeed API (google/nano-banana-pro/edit)
 * @param referenceImageBase64 - Image de référence en base64 (le modèle)
 * @param prompt - Le prompt de génération
 * @returns Buffer de l'image générée
 */
export async function generateImageWithWavespeed(
  referenceImageBase64: string,
  prompt: string
): Promise<Buffer> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new WavespeedError(
      'Configurez votre clé Wavespeed API dans Settings',
      'NOT_CONFIGURED'
    )
  }

  try {
    console.log('Wavespeed generation starting...')

    const response = await fetch(WAVESPEED_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Image de référence en base64 avec préfixe data URI
        image: `data:image/jpeg;base64,${referenceImageBase64}`,
        // Prompt de génération
        prompt: prompt,
        // Paramètres optionnels pour le modèle nano-banana-pro
        seed: Math.floor(Math.random() * 1000000),
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
        `Erreur Wavespeed: ${errorData.message || errorData.error || JSON.stringify(errorData)}`,
        'API_ERROR'
      )
    }

    const result = await response.json()

    // Extraire l'image selon le format de réponse Wavespeed
    // Le format peut varier selon l'API, on gère plusieurs cas
    let imageBase64: string | null = null

    if (result.data?.output?.[0]) {
      // Format avec URL - télécharger l'image
      const imageUrl = result.data.output[0]
      console.log('Wavespeed returned URL, downloading...')
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new WavespeedError(
          'Impossible de télécharger l\'image générée',
          'GENERATION_FAILED'
        )
      }
      const arrayBuffer = await imageResponse.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } else if (result.image) {
      // Format avec image en base64 directement
      imageBase64 = result.image.replace(/^data:image\/\w+;base64,/, '')
    } else if (result.output) {
      // Autre format possible
      imageBase64 = result.output.replace(/^data:image\/\w+;base64,/, '')
    } else if (result.result) {
      // Encore un autre format
      imageBase64 = result.result.replace(/^data:image\/\w+;base64,/, '')
    }

    if (!imageBase64) {
      console.error('Wavespeed response format:', JSON.stringify(result).substring(0, 500))
      throw new WavespeedError(
        'Format de réponse Wavespeed inattendu',
        'GENERATION_FAILED'
      )
    }

    console.log('Wavespeed generation completed successfully')
    return Buffer.from(imageBase64, 'base64')
  } catch (error) {
    // Gérer les erreurs spécifiques
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
