import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import prisma from '@/lib/prisma'
import { generateImage, getReferencePhotoPath, WavespeedError } from '@/lib/wavespeed'

/**
 * POST /api/photos/[id]/generate
 * Génère une image via Wavespeed à partir de la photo de référence + prompt
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

    // Générer l'image via Wavespeed
    const result = await generateImage(
      referenceBuffer,
      sourcePhoto.generatedPrompt,
      sourcePhoto.id
    )

    if (!result.success || !result.localPath) {
      return NextResponse.json(
        { error: result.error || 'La génération a échoué' },
        { status: 500 }
      )
    }

    // Créer l'entrée dans GeneratedPhoto
    const generatedPhoto = await prisma.generatedPhoto.create({
      data: {
        sourcePhotoId: sourcePhoto.id,
        prompt: sourcePhoto.generatedPrompt,
        localPath: result.localPath,
      }
    })

    return NextResponse.json({
      success: true,
      generatedPhoto: {
        id: generatedPhoto.id,
        localPath: generatedPhoto.localPath,
        prompt: generatedPhoto.prompt,
        createdAt: generatedPhoto.createdAt.toISOString(),
      }
    })
  } catch (error) {
    console.error('Error generating image:', error)

    // Gérer les erreurs Wavespeed spécifiques
    if (error instanceof WavespeedError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'NO_REFERENCE': 400,
        'API_ERROR': 502,
        'TIMEOUT': 504,
        'GENERATION_FAILED': 500,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    )
  }
}
