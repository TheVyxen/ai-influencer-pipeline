/**
 * Service Wavespeed pour la génération img2img
 * Utilise une photo de référence + prompt pour générer de nouvelles images
 */

import { readFile, writeFile, access } from 'fs/promises'
import path from 'path'
import prisma from './prisma'
import { removeExifFromBuffer } from './exif-remover'

// Chemins possibles pour la photo de référence
const REFERENCE_PATHS = [
  path.join(process.cwd(), 'public', 'reference', 'model.jpg'),
  path.join(process.cwd(), 'public', 'reference', 'model.png'),
]

/**
 * Types d'erreurs possibles
 */
export class WavespeedError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'NO_REFERENCE' | 'API_ERROR' | 'TIMEOUT' | 'GENERATION_FAILED' | 'UNKNOWN'
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
 * Trouve et retourne le chemin de la photo de référence
 */
export async function getReferencePhotoPath(): Promise<string | null> {
  for (const refPath of REFERENCE_PATHS) {
    try {
      await access(refPath)
      return refPath
    } catch {
      // Fichier n'existe pas, continuer
    }
  }
  return null
}

/**
 * Résultat de la génération
 */
export interface GenerationResult {
  success: boolean
  localPath?: string
  error?: string
}

/**
 * Génère une image via Wavespeed API
 * @param referenceImageBuffer - Buffer de l'image de référence (modèle)
 * @param prompt - Le prompt de génération
 * @param sourcePhotoId - ID de la photo source (pour le nom du fichier)
 * @returns Résultat avec le chemin de l'image générée
 */
export async function generateImage(
  referenceImageBuffer: Buffer,
  prompt: string,
  sourcePhotoId: string
): Promise<GenerationResult> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new WavespeedError(
      'Wavespeed API key is not configured',
      'NOT_CONFIGURED'
    )
  }

  try {
    // Convertir l'image de référence en base64
    const base64Image = referenceImageBuffer.toString('base64')

    // Appeler l'API Wavespeed
    // Note: Cette implémentation utilise un format d'API standard
    // Ajustez l'URL et les paramètres selon la documentation Wavespeed
    const response = await fetch('https://api.wavespeed.ai/api/v2/wavespeed-ai/pulid/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Image de référence en base64
        main_face_image: `data:image/jpeg;base64,${base64Image}`,
        // Prompt de génération
        prompt: prompt,
        // Paramètres de génération
        num_steps: 4,
        guidance_scale: 1.2,
        seed: Math.floor(Math.random() * 1000000),
        // enable_safety_checker: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 429) {
        throw new WavespeedError(
          'Trop de requêtes, réessayez dans quelques secondes',
          'API_ERROR'
        )
      }

      if (response.status === 401 || response.status === 403) {
        throw new WavespeedError(
          'Clé API Wavespeed invalide',
          'NOT_CONFIGURED'
        )
      }

      throw new WavespeedError(
        `Erreur Wavespeed: ${errorText}`,
        'API_ERROR'
      )
    }

    const result = await response.json()

    // Wavespeed retourne généralement une URL ou une image en base64
    // Adapter selon leur format de réponse réel
    let imageData: Buffer

    if (result.data?.output?.[0]) {
      // Si l'API retourne une URL
      const imageUrl = result.data.output[0]
      const imageResponse = await fetch(imageUrl)
      const arrayBuffer = await imageResponse.arrayBuffer()
      imageData = Buffer.from(arrayBuffer)
    } else if (result.image || result.output) {
      // Si l'API retourne directement en base64
      const base64Data = (result.image || result.output).replace(/^data:image\/\w+;base64,/, '')
      imageData = Buffer.from(base64Data, 'base64')
    } else {
      throw new WavespeedError(
        'Format de réponse Wavespeed inattendu',
        'GENERATION_FAILED'
      )
    }

    // Générer le nom du fichier
    const timestamp = Date.now()
    const fileName = `generated_${sourcePhotoId}_${timestamp}.jpg`
    const outputPath = path.join(process.cwd(), 'public', 'generated', fileName)

    // Supprimer les métadonnées EXIF de l'image avant sauvegarde
    const cleanImageData = await removeExifFromBuffer(imageData)
    await writeFile(outputPath, cleanImageData)

    return {
      success: true,
      localPath: `/generated/${fileName}`,
    }
  } catch (error) {
    if (error instanceof WavespeedError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new WavespeedError(
        'La génération prend trop de temps, réessayez',
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

    throw new WavespeedError(
      `Erreur lors de la génération: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}
