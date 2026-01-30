/**
 * Service Veo pour la génération vidéo (image → vidéo)
 * Provider: Gemini API (Google)
 * API: REST API avec clé API
 * Documentation: https://ai.google.dev/gemini-api/docs/video
 */

import prisma from './prisma'

/**
 * Types d'erreurs possibles pour Veo
 */
export class VeoError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'AUTH_ERROR' | 'GENERATION_FAILED' | 'POLLING_TIMEOUT' | 'STORAGE_ERROR' | 'RATE_LIMIT' | 'CONTENT_BLOCKED' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'VeoError'
  }
}

/**
 * Configuration pour la génération vidéo
 * Note: 1080p et 4k nécessitent une durée de 8 secondes
 */
export interface VideoGenerationConfig {
  prompt?: string              // Prompt optionnel pour guider la génération
  aspectRatio: '9:16' | '16:9' // Format de la vidéo
  duration: 4 | 6 | 8          // Durée en secondes (4, 6, ou 8)
  resolution?: '720p' | '1080p' | '4k' // Résolution de la vidéo
}

/**
 * Résultat du lancement d'une génération
 */
export interface GenerationResult {
  operationName: string  // ID de l'opération pour polling
  outputGcsUri: string   // URI où la vidéo sera disponible (ou placeholder)
}

/**
 * Statut d'une opération de génération
 */
export interface OperationStatus {
  done: boolean
  error?: string
  videoUri?: string
}

/**
 * Récupère la clé API Gemini depuis les settings
 */
async function getGeminiApiKey(): Promise<string | null> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: 'google_ai_api_key' }
  })
  return setting?.value || process.env.GOOGLE_AI_API_KEY || null
}

/**
 * Vérifie si Veo est correctement configuré
 */
export async function isVeoConfigured(): Promise<boolean> {
  const apiKey = await getGeminiApiKey()
  return !!apiKey
}

/**
 * Lance la génération d'une vidéo à partir d'une image
 * @param imageBase64 - Image en base64 (sans préfixe data:)
 * @param mimeType - Type MIME de l'image (image/jpeg, image/png)
 * @param config - Configuration de génération (prompt, format, durée)
 * @returns Résultat avec l'ID d'opération
 */
export async function generateVideoFromImage(
  imageBase64: string,
  mimeType: string,
  config: VideoGenerationConfig
): Promise<GenerationResult> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) {
    throw new VeoError(
      'Clé API Gemini non configurée',
      'NOT_CONFIGURED'
    )
  }

  // Vérifier que l'image n'est pas vide
  if (!imageBase64 || imageBase64.length === 0) {
    throw new VeoError('Image source vide', 'GENERATION_FAILED')
  }

  // Générer un identifiant unique pour cette génération
  const timestamp = Date.now()

  // Construire le prompt
  const prompt = config.prompt || 'Animate this image with natural, subtle movements. Maintain the original composition and lighting.'

  try {
    // Endpoint Gemini API pour Veo 3.1
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning`

    // Corps de la requête selon la doc Gemini API Veo 3.1
    // personGeneration: "allow_adult" pour permettre la génération avec des personnes
    const requestBody = {
      instances: [
        {
          prompt: prompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: mimeType,
          },
        },
      ],
      parameters: {
        aspectRatio: config.aspectRatio,
        sampleCount: 1,
        durationSeconds: config.duration,
        resolution: config.resolution || '1080p',
        personGeneration: 'allow_adult',
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${responseText}`)
    }

    const result = JSON.parse(responseText)
    console.log('Veo generation response:', JSON.stringify(result).substring(0, 1000))

    // Extraire le nom de l'opération
    // Format retourné: "models/veo-3.1-generate-preview/operations/xxx"
    const operationName = result.name || result.operationId || `operation-${timestamp}`

    console.log('Operation name for polling:', operationName)

    return {
      operationName: operationName,
      outputGcsUri: `gemini-video-${timestamp}`, // Placeholder, la vraie URL vient du polling
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Veo API error:', errorMessage)

    // Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      throw new VeoError(
        'Trop de requêtes, réessayez dans quelques minutes',
        'RATE_LIMIT'
      )
    }

    // Contenu bloqué
    if (errorMessage.includes('blocked') || errorMessage.includes('safety') || errorMessage.includes('HARM')) {
      throw new VeoError(
        'L\'image a été bloquée par les filtres de sécurité',
        'CONTENT_BLOCKED'
      )
    }

    // Erreur d'authentification
    if (errorMessage.includes('auth') || errorMessage.includes('credential') || errorMessage.includes('permission') || errorMessage.includes('403') || errorMessage.includes('API_KEY')) {
      throw new VeoError(
        'Erreur d\'authentification. Vérifiez votre clé API Gemini.',
        'AUTH_ERROR'
      )
    }

    throw new VeoError(
      `Erreur de génération: ${errorMessage}`,
      'GENERATION_FAILED'
    )
  }
}

/**
 * Vérifie le statut d'une opération de génération
 * Utilise l'endpoint GET sur l'opération pour Gemini API
 * @param operationName - Nom complet de l'opération (ex: operations/xxx)
 * @returns Statut de l'opération
 */
export async function getOperationStatus(operationName: string): Promise<OperationStatus> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) {
    throw new VeoError('Clé API Gemini non configurée', 'NOT_CONFIGURED')
  }

  try {
    // Pour Gemini API, on utilise GET sur l'opération directement
    // Le nom de l'opération est déjà au format "operations/xxx"
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('Veo operation status:', JSON.stringify(result).substring(0, 1000))

    if (result.error) {
      return {
        done: true,
        error: result.error.message || 'Erreur de génération',
      }
    }

    if (result.done) {
      // Chercher l'URI de la vidéo dans la réponse
      // Format Gemini API: response.videos[0].uri ou downloadUri
      const videoUri = result.response?.videos?.[0]?.uri ||
                       result.response?.videos?.[0]?.downloadUri ||
                       result.response?.generatedSamples?.[0]?.video?.uri ||
                       result.response?.generatedSamples?.[0]?.video?.downloadUri ||
                       result.response?.predictions?.[0]?.videoUri

      // Si done mais pas de videoUri, c'est une erreur non détectée
      if (!videoUri) {
        console.error('Operation done but no videoUri found:', JSON.stringify(result).substring(0, 500))
        return {
          done: true,
          error: 'La génération a terminé mais aucune vidéo n\'a été créée. Veuillez réessayer.',
        }
      }

      console.log('Video generated successfully:', videoUri)
      return {
        done: true,
        videoUri: videoUri,
      }
    }

    return { done: false }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error checking operation status:', errorMessage)
    throw new VeoError(
      `Erreur lors de la vérification du statut: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}

/**
 * Télécharge une vidéo depuis son URI (Gemini API ou GCS)
 * @param videoUri - URI de la vidéo
 * @returns Buffer contenant les données de la vidéo
 */
export async function streamVideoFromGcs(videoUri: string): Promise<Buffer> {
  // Pour Gemini API, l'URI est une URL de téléchargement directe
  if (videoUri.startsWith('http')) {
    try {
      const response = await fetch(videoUri)
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new VeoError(
        `Erreur lors du téléchargement de la vidéo: ${errorMessage}`,
        'STORAGE_ERROR'
      )
    }
  }

  // Fallback pour les anciennes URIs GCS (gs://...)
  if (videoUri.startsWith('gs://')) {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()

    const match = videoUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (!match) {
      throw new VeoError(
        `URI invalide: ${videoUri}`,
        'STORAGE_ERROR'
      )
    }

    const bucketName = match[1]
    const filePath = match[2]

    try {
      const [buffer] = await storage
        .bucket(bucketName)
        .file(filePath)
        .download()

      return buffer
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new VeoError(
        `Erreur lors du téléchargement de la vidéo: ${errorMessage}`,
        'STORAGE_ERROR'
      )
    }
  }

  throw new VeoError(
    `URI de vidéo non supportée: ${videoUri}`,
    'STORAGE_ERROR'
  )
}

/**
 * Génère une URL signée pour accéder à une vidéo
 * Pour Gemini API, retourne directement l'URI si c'est déjà une URL HTTP
 * @param videoUri - URI de la vidéo
 * @returns URL pour accéder à la vidéo
 */
export async function getSignedVideoUrl(videoUri: string): Promise<string> {
  // Si c'est déjà une URL HTTP, la retourner directement
  if (videoUri.startsWith('http')) {
    return videoUri
  }

  // Pour les URIs GCS, générer une URL signée
  if (videoUri.startsWith('gs://')) {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()

    const match = videoUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (!match) {
      throw new VeoError(
        `URI GCS invalide: ${videoUri}`,
        'STORAGE_ERROR'
      )
    }

    const bucketName = match[1]
    const filePath = match[2]

    try {
      const [url] = await storage
        .bucket(bucketName)
        .file(filePath)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 heure
        })

      return url
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new VeoError(
        `Erreur lors de la génération de l'URL signée: ${errorMessage}`,
        'STORAGE_ERROR'
      )
    }
  }

  throw new VeoError(
    `URI de vidéo non supportée: ${videoUri}`,
    'STORAGE_ERROR'
  )
}

/**
 * Vérifie si une vidéo existe (toujours true pour les URLs HTTP)
 * @param videoUri - URI de la vidéo
 * @returns true si la vidéo existe
 */
export async function videoExistsOnGcs(videoUri: string): Promise<boolean> {
  // Pour les URLs HTTP, on suppose qu'elles existent
  if (videoUri.startsWith('http')) {
    return true
  }

  // Pour les URIs GCS
  if (videoUri.startsWith('gs://')) {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()

    const match = videoUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (!match) {
      return false
    }

    const bucketName = match[1]
    const filePath = match[2]

    try {
      const [exists] = await storage
        .bucket(bucketName)
        .file(filePath)
        .exists()
      return exists
    } catch {
      return false
    }
  }

  return false
}

/**
 * Supprime une vidéo (non applicable pour Gemini API URLs)
 * @param videoUri - URI de la vidéo
 */
export async function deleteVideoFromGcs(videoUri: string): Promise<void> {
  // Pour les URLs HTTP de Gemini API, on ne peut pas les supprimer
  if (videoUri.startsWith('http')) {
    console.log('Cannot delete HTTP video URL, skipping:', videoUri)
    return
  }

  // Pour les URIs GCS
  if (videoUri.startsWith('gs://')) {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()

    const match = videoUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (!match) {
      throw new VeoError(
        `URI GCS invalide: ${videoUri}`,
        'STORAGE_ERROR'
      )
    }

    const bucketName = match[1]
    const filePath = match[2]

    try {
      await storage
        .bucket(bucketName)
        .file(filePath)
        .delete()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Ignorer les erreurs si le fichier n'existe pas
      if (!errorMessage.includes('404') && !errorMessage.includes('Not Found')) {
        throw new VeoError(
          `Erreur lors de la suppression: ${errorMessage}`,
          'STORAGE_ERROR'
        )
      }
    }
  }
}
