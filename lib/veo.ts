/**
 * Service Veo pour la génération vidéo (image → vidéo)
 * Provider: Vertex AI (Google Cloud)
 * API: REST API avec authentification ADC
 * Stockage: Google Cloud Storage
 */

import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'

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
 */
export interface VideoGenerationConfig {
  prompt?: string              // Prompt optionnel pour guider la génération
  aspectRatio: '9:16' | '16:9' // Format de la vidéo
  duration: 5 | 6 | 7 | 8      // Durée en secondes
  resolution?: '720p' | '1080p' | '4k' // Résolution de la vidéo
}

/**
 * Résultat du lancement d'une génération
 */
export interface GenerationResult {
  operationName: string  // ID de l'opération pour polling
  outputGcsUri: string   // URI GCS où la vidéo sera stockée
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
 * Récupère la configuration GCP depuis les variables d'environnement
 */
function getGcpConfig(): { projectId: string; location: string; bucketName: string } | null {
  const projectId = process.env.GCP_PROJECT_ID
  const location = process.env.GCP_LOCATION || 'us-central1'
  const bucketName = process.env.GCS_BUCKET_NAME

  if (!projectId || !bucketName) {
    return null
  }

  return { projectId, location, bucketName }
}

/**
 * Vérifie si Veo est correctement configuré
 */
export async function isVeoConfigured(): Promise<boolean> {
  const config = getGcpConfig()
  if (!config) {
    return false
  }

  // Vérifier si ADC existe
  const fs = await import('fs')
  const path = await import('path')
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  const adcPath = path.join(homeDir, '.config', 'gcloud', 'application_default_credentials.json')

  try {
    await fs.promises.access(adcPath)
    return true
  } catch {
    // Vérifier aussi GOOGLE_APPLICATION_CREDENTIALS
    return !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  }
}

/**
 * Crée un client authentifié pour les requêtes API
 */
async function getAuthClient() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getClient()
}

/**
 * Crée le client Google Cloud Storage
 */
function getStorageClient(): Storage {
  return new Storage()
}

/**
 * Lance la génération d'une vidéo à partir d'une image
 * @param imageBase64 - Image en base64 (sans préfixe data:)
 * @param mimeType - Type MIME de l'image (image/jpeg, image/png)
 * @param config - Configuration de génération (prompt, format, durée)
 * @returns Résultat avec l'ID d'opération et l'URI GCS de sortie
 */
export async function generateVideoFromImage(
  imageBase64: string,
  mimeType: string,
  config: VideoGenerationConfig
): Promise<GenerationResult> {
  const gcpConfig = getGcpConfig()
  if (!gcpConfig) {
    throw new VeoError(
      'Configuration GCP manquante',
      'NOT_CONFIGURED'
    )
  }

  // Vérifier que l'image n'est pas vide
  if (!imageBase64 || imageBase64.length === 0) {
    throw new VeoError('Image source vide', 'GENERATION_FAILED')
  }

  // Générer un nom unique pour la vidéo de sortie
  const timestamp = Date.now()
  const outputPath = `videos/${timestamp}.mp4`
  const outputGcsUri = `gs://${gcpConfig.bucketName}/${outputPath}`

  // Construire le prompt
  const prompt = config.prompt || 'Animate this image with natural, subtle movements. Maintain the original composition and lighting.'

  try {
    const authClient = await getAuthClient()
    const accessToken = await authClient.getAccessToken()

    // Endpoint Vertex AI pour Veo
    const endpoint = `https://${gcpConfig.location}-aiplatform.googleapis.com/v1/projects/${gcpConfig.projectId}/locations/${gcpConfig.location}/publishers/google/models/veo-2.0-generate-001:predictLongRunning`

    // Corps de la requête selon la doc Vertex AI
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
        storageUri: outputGcsUri,
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${responseText}`)
    }

    const result = JSON.parse(responseText)

    // Extraire le nom de l'opération
    const operationName = result.name || result.operationId || `operation-${timestamp}`

    return {
      operationName: operationName,
      outputGcsUri: outputGcsUri,
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
    if (errorMessage.includes('auth') || errorMessage.includes('credential') || errorMessage.includes('permission') || errorMessage.includes('403')) {
      throw new VeoError(
        'Erreur d\'authentification GCP. Vérifiez vos credentials.',
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
 * Utilise l'endpoint fetchPredictOperation selon la doc Vertex AI
 * @param operationName - Nom complet de l'opération
 * @returns Statut de l'opération
 */
export async function getOperationStatus(operationName: string): Promise<OperationStatus> {
  const gcpConfig = getGcpConfig()
  if (!gcpConfig) {
    throw new VeoError('Configuration GCP manquante', 'NOT_CONFIGURED')
  }

  try {
    const authClient = await getAuthClient()
    const accessToken = await authClient.getAccessToken()

    // L'endpoint fetchPredictOperation est utilisé pour vérifier le statut
    const endpoint = `https://${gcpConfig.location}-aiplatform.googleapis.com/v1/projects/${gcpConfig.projectId}/locations/${gcpConfig.location}/publishers/google/models/veo-2.0-generate-001:fetchPredictOperation`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: operationName,
      }),
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
      // Format Veo: response.videos[0].gcsUri
      const videoUri = result.response?.videos?.[0]?.gcsUri ||
                       result.response?.generatedSamples?.[0]?.video?.uri ||
                       result.response?.generatedSamples?.[0]?.video?.gcsUri ||
                       result.response?.predictions?.[0]?.videoUri ||
                       result.metadata?.outputInfo?.videoOutputUri

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
 * Génère une URL signée pour accéder à une vidéo sur GCS
 * L'URL est valide pendant 1 heure
 * @param gcsUri - URI GCS de la vidéo (gs://bucket/path)
 * @returns URL signée pour accéder à la vidéo
 */
export async function getSignedVideoUrl(gcsUri: string): Promise<string> {
  const storage = getStorageClient()

  // Parser l'URI GCS (gs://bucket/path)
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    throw new VeoError(
      `URI GCS invalide: ${gcsUri}`,
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

/**
 * Supprime une vidéo de GCS
 * @param gcsUri - URI GCS de la vidéo (gs://bucket/path)
 */
export async function deleteVideoFromGcs(gcsUri: string): Promise<void> {
  const storage = getStorageClient()

  // Parser l'URI GCS
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    throw new VeoError(
      `URI GCS invalide: ${gcsUri}`,
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

/**
 * Vérifie si une vidéo existe sur GCS
 * @param gcsUri - URI GCS de la vidéo
 * @returns true si la vidéo existe
 */
export async function videoExistsOnGcs(gcsUri: string): Promise<boolean> {
  const storage = getStorageClient()

  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
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

/**
 * Télécharge une vidéo depuis GCS et retourne le buffer
 * Utilisé car les signed URLs ne fonctionnent pas avec ADC user credentials
 * @param gcsUri - URI GCS de la vidéo (gs://bucket/path)
 * @returns Buffer contenant les données de la vidéo
 */
export async function streamVideoFromGcs(gcsUri: string): Promise<Buffer> {
  const storage = getStorageClient()

  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    throw new VeoError(
      `URI GCS invalide: ${gcsUri}`,
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
