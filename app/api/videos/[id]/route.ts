import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { deleteVideoFromGcs } from '@/lib/veo'

/**
 * GET /api/videos/[id]
 * Récupère les détails d'une vidéo générée
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    console.error('Error fetching video:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/videos/[id]
 * Supprime une vidéo générée (BDD + GCS)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Récupérer la vidéo pour avoir l'URI GCS
    const video = await prisma.generatedVideo.findUnique({
      where: { id },
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vidéo non trouvée' },
        { status: 404 }
      )
    }

    // Supprimer la vidéo de GCS si elle existe
    if (video.gcsUri) {
      try {
        await deleteVideoFromGcs(video.gcsUri)
      } catch (gcsError) {
        console.error('Error deleting video from GCS:', gcsError)
        // Continuer même si la suppression GCS échoue
      }
    }

    // Supprimer l'entrée de la base de données
    await prisma.generatedVideo.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}
