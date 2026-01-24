import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateVideoFromImage, isVeoConfigured, VeoError } from '@/lib/veo'

/**
 * POST /api/videos/[id]/generate
 * Lance la génération d'une vidéo à partir d'une image source
 * Body: { prompt?: string, aspectRatio: string, duration: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params
    const body = await request.json()

    // Valider les paramètres
    const { prompt, aspectRatio, duration, resolution } = body

    if (!aspectRatio || !['9:16', '16:9'].includes(aspectRatio)) {
      return NextResponse.json(
        { error: 'Format invalide. Choisissez 9:16 ou 16:9.' },
        { status: 400 }
      )
    }

    if (!duration || ![5, 6, 7, 8].includes(duration)) {
      return NextResponse.json(
        { error: 'Durée invalide. Choisissez 5, 6, 7 ou 8 secondes.' },
        { status: 400 }
      )
    }

    const validResolutions = ['720p', '1080p', '4k']
    if (resolution && !validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: 'Résolution invalide. Choisissez 720p, 1080p ou 4k.' },
        { status: 400 }
      )
    }

    // Vérifier que Veo est configuré
    const configured = await isVeoConfigured()
    if (!configured) {
      return NextResponse.json(
        { error: 'Veo n\'est pas configuré. Vérifiez les variables d\'environnement GCP.' },
        { status: 503 }
      )
    }

    // Récupérer l'image source
    const source = await prisma.videoSource.findUnique({
      where: { id: sourceId },
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Image source non trouvée' },
        { status: 404 }
      )
    }

    // Créer l'entrée GeneratedVideo avec status "processing"
    const video = await prisma.generatedVideo.create({
      data: {
        sourceId: sourceId,
        prompt: prompt || null,
        aspectRatio: aspectRatio,
        duration: duration,
        resolution: resolution || '1080p',
        status: 'processing',
      }
    })

    try {
      // Lancer la génération via Veo
      const result = await generateVideoFromImage(
        source.imageData,
        source.mimeType,
        {
          prompt: prompt,
          aspectRatio: aspectRatio as '9:16' | '16:9',
          duration: duration as 5 | 6 | 7 | 8,
          resolution: (resolution || '1080p') as '720p' | '1080p' | '4k',
        }
      )

      // Mettre à jour avec l'ID d'opération et l'URI de sortie
      await prisma.generatedVideo.update({
        where: { id: video.id },
        data: {
          operationId: result.operationName,
          gcsUri: result.outputGcsUri,
        }
      })

      return NextResponse.json({
        id: video.id,
        operationId: result.operationName,
        status: 'processing',
      })
    } catch (veoError) {
      // En cas d'erreur, marquer la vidéo comme failed
      const errorMessage = veoError instanceof VeoError
        ? veoError.message
        : veoError instanceof Error
          ? veoError.message
          : 'Erreur de génération inconnue'

      await prisma.generatedVideo.update({
        where: { id: video.id },
        data: {
          status: 'failed',
          errorMessage: errorMessage,
        }
      })

      // Retourner l'erreur appropriée
      if (veoError instanceof VeoError) {
        const statusCode = veoError.code === 'NOT_CONFIGURED' ? 503
          : veoError.code === 'RATE_LIMIT' ? 429
          : veoError.code === 'AUTH_ERROR' ? 401
          : 500

        return NextResponse.json(
          { error: veoError.message, code: veoError.code },
          { status: statusCode }
        )
      }

      throw veoError
    }
  } catch (error) {
    console.error('Error generating video:', error)
    return NextResponse.json(
      { error: 'Failed to generate video' },
      { status: 500 }
    )
  }
}
