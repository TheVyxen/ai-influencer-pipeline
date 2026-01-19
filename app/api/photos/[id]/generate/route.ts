import { NextRequest, NextResponse } from 'next/server'
import { readFile, access, writeFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { generateImageWithGeminiWithRetry, GoogleAIError, ImageGenerationConfig } from '@/lib/google-ai'
import { generateImageWithWavespeed, WavespeedError } from '@/lib/wavespeed'
import { removeExifFromBuffer } from '@/lib/exif-remover'

// Chemins possibles pour la photo de référence
const REFERENCE_PATHS = [
  path.join(process.cwd(), 'public', 'reference', 'model.jpg'),
  path.join(process.cwd(), 'public', 'reference', 'model.png'),
]

/**
 * Trouve et retourne le chemin de la photo de référence
 */
async function getReferencePhotoPath(): Promise<string | null> {
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
 * Récupère la configuration de génération depuis les Settings
 */
interface GenerationSettings {
  provider: 'gemini' | 'wavespeed'
  aspectRatio: '9:16' | '1:1' | '16:9'
  imageSize: '1K' | '2K' | '4K'
}

async function getGenerationSettings(): Promise<GenerationSettings> {
  try {
    const [providerSetting, aspectRatioSetting, imageSizeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'image_provider' } }),
      prisma.settings.findUnique({ where: { key: 'image_aspect_ratio' } }),
      prisma.settings.findUnique({ where: { key: 'image_size' } }),
    ])

    return {
      provider: (providerSetting?.value as 'gemini' | 'wavespeed') || 'gemini',
      aspectRatio: (aspectRatioSetting?.value as '9:16' | '1:1' | '16:9') || '9:16',
      imageSize: (imageSizeSetting?.value as '1K' | '2K' | '4K') || '2K',
    }
  } catch {
    // Valeurs par défaut en cas d'erreur
    return { provider: 'gemini', aspectRatio: '9:16', imageSize: '2K' }
  }
}

/**
 * POST /api/photos/[id]/generate
 * Génère une image via Gemini ou Wavespeed selon la configuration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer la photo source
    const sourcePhoto = await prisma.sourcePhoto.findUnique({
      where: { id }
    })

    if (!sourcePhoto) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Vérifier que la photo est approuvée
    if (sourcePhoto.status !== 'approved') {
      return NextResponse.json(
        { error: 'Photo must be approved before generating' },
        { status: 400 }
      )
    }

    // Vérifier qu'on a un prompt généré
    if (!sourcePhoto.generatedPrompt) {
      return NextResponse.json(
        { error: 'Photo must be described before generating. Use /api/photos/[id]/describe first.' },
        { status: 400 }
      )
    }

    // Récupérer la photo de référence du modèle
    const referencePhotoPath = await getReferencePhotoPath()

    if (!referencePhotoPath) {
      return NextResponse.json(
        { error: 'Configurez d\'abord votre photo de référence dans Settings' },
        { status: 400 }
      )
    }

    // Charger l'image de référence
    let referenceBuffer: Buffer
    try {
      referenceBuffer = await readFile(referencePhotoPath)
    } catch {
      return NextResponse.json(
        { error: 'Impossible de lire la photo de référence' },
        { status: 500 }
      )
    }

    // Convertir en base64 pour les APIs
    const referenceBase64 = referenceBuffer.toString('base64')

    // Récupérer la configuration de génération
    const settings = await getGenerationSettings()
    const provider = settings.provider

    console.log(`Starting generation with provider: ${provider}`)

    // Générer l'image selon le provider sélectionné
    let generatedImageBuffer: Buffer

    if (provider === 'wavespeed') {
      // Génération via Wavespeed (google/nano-banana-pro/edit)
      generatedImageBuffer = await generateImageWithWavespeed(
        referenceBase64,
        sourcePhoto.generatedPrompt
      )
    } else {
      // Génération via Gemini avec retry automatique (3 tentatives, 5s entre chaque)
      const imageConfig: ImageGenerationConfig = {
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize,
      }
      generatedImageBuffer = await generateImageWithGeminiWithRetry(
        referenceBase64,
        sourcePhoto.generatedPrompt,
        imageConfig,
        3,    // maxRetries
        5000  // delayMs
      )
    }

    // Supprimer les métadonnées EXIF de l'image avant sauvegarde
    const cleanImageData = await removeExifFromBuffer(generatedImageBuffer)

    // Générer le nom du fichier et sauvegarder
    const timestamp = Date.now()
    const fileName = `generated_${sourcePhoto.id}_${timestamp}.jpg`
    const outputPath = path.join(process.cwd(), 'public', 'generated', fileName)

    await writeFile(outputPath, cleanImageData)

    const localPath = `/generated/${fileName}`

    // Créer l'entrée dans GeneratedPhoto
    const generatedPhoto = await prisma.generatedPhoto.create({
      data: {
        sourcePhotoId: sourcePhoto.id,
        prompt: sourcePhoto.generatedPrompt,
        localPath: localPath,
      }
    })

    return NextResponse.json({
      success: true,
      provider: provider,
      generatedPhoto: {
        id: generatedPhoto.id,
        localPath: generatedPhoto.localPath,
        prompt: generatedPhoto.prompt,
        createdAt: generatedPhoto.createdAt.toISOString(),
      }
    })
  } catch (error) {
    console.error('Error generating image:', error)

    // Gérer les erreurs Google AI spécifiques
    if (error instanceof GoogleAIError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'RATE_LIMIT': 429,
        'INVALID_IMAGE': 400,
        'CONTENT_BLOCKED': 400,
        'TIMEOUT': 504,
        'CONNECTION_ERROR': 502,
        'GENERATION_FAILED': 500,
        'UNKNOWN': 500,
      }

      // Ajouter un conseil pour les erreurs de surcharge
      let errorMessage = error.message
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        errorMessage += '. Conseil: basculez sur Wavespeed dans Settings si le problème persiste.'
      }

      return NextResponse.json(
        { error: errorMessage, code: error.code, provider: 'gemini' },
        { status: statusCodes[error.code] || 500 }
      )
    }

    // Gérer les erreurs Wavespeed spécifiques
    if (error instanceof WavespeedError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'RATE_LIMIT': 429,
        'API_ERROR': 502,
        'TIMEOUT': 504,
        'GENERATION_FAILED': 500,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code, provider: 'wavespeed' },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    )
  }
}
