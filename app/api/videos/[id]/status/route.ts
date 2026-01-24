import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getOperationStatus, VeoError } from '@/lib/veo'

/**
 * GET /api/videos/[id]/status
 * Vérifie le statut d'une génération vidéo en cours
 * Utilisé pour le polling côté client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Récupérer la vidéo
    const video = await prisma.generatedVideo.findUnique({
      where: { id },
      include: {
        source: {
          select: {
            id: true,
            originalName: true,
          }
        }
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vidéo non trouvée' },
        { status: 404 }
      )
    }

    // Si la vidéo est déjà terminée (completed ou failed), retourner le statut actuel
    if (video.status === 'completed' || video.status === 'failed') {
      return NextResponse.json({
        id: video.id,
        sourceId: video.sourceId,
        prompt: video.prompt,
        aspectRatio: video.aspectRatio,
        duration: video.duration,
        status: video.status,
        operationId: video.operationId,
        gcsUri: video.gcsUri,
        errorMessage: video.errorMessage,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        source: video.source,
      })
    }

    // Si en processing et qu'on a un operationId, vérifier le statut auprès de Vertex AI
    if (video.status === 'processing' && video.operationId) {
      try {
        const opStatus = await getOperationStatus(video.operationId)

        if (opStatus.done) {
          if (opStatus.error) {
            // L'opération a échoué
            await prisma.generatedVideo.update({
              where: { id },
              data: {
                status: 'failed',
                errorMessage: opStatus.error,
              }
            })

            return NextResponse.json({
              id: video.id,
              sourceId: video.sourceId,
              prompt: video.prompt,
              aspectRatio: video.aspectRatio,
              duration: video.duration,
              status: 'failed',
              operationId: video.operationId,
              gcsUri: video.gcsUri,
              errorMessage: opStatus.error,
              createdAt: video.createdAt.toISOString(),
              updatedAt: new Date().toISOString(),
              source: video.source,
            })
          } else {
            // L'opération a réussi
            const updatedVideo = await prisma.generatedVideo.update({
              where: { id },
              data: {
                status: 'completed',
                gcsUri: opStatus.videoUri || video.gcsUri,
              }
            })

            return NextResponse.json({
              id: video.id,
              sourceId: video.sourceId,
              prompt: video.prompt,
              aspectRatio: video.aspectRatio,
              duration: video.duration,
              status: 'completed',
              operationId: video.operationId,
              gcsUri: updatedVideo.gcsUri,
              errorMessage: null,
              createdAt: video.createdAt.toISOString(),
              updatedAt: updatedVideo.updatedAt.toISOString(),
              source: video.source,
            })
          }
        }
      } catch (veoError) {
        console.error('Error checking operation status:', veoError)
        // Ne pas échouer le polling si la vérification échoue
        // Le client réessaiera
      }
    }

    // Retourner le statut actuel sans modification
    return NextResponse.json({
      id: video.id,
      sourceId: video.sourceId,
      prompt: video.prompt,
      aspectRatio: video.aspectRatio,
      duration: video.duration,
      status: video.status,
      operationId: video.operationId,
      gcsUri: video.gcsUri,
      errorMessage: video.errorMessage,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
      source: video.source,
    })
  } catch (error) {
    console.error('Error checking video status:', error)
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    )
  }
}
