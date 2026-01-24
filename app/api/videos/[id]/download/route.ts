import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { streamVideoFromGcs, videoExistsOnGcs, VeoError } from '@/lib/veo'

/**
 * GET /api/videos/[id]/download
 * Stream la vidéo depuis GCS
 * Utilise le streaming car les signed URLs ne fonctionnent pas avec ADC user credentials
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
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vidéo non trouvée' },
        { status: 404 }
      )
    }

    // Vérifier que la vidéo est complétée
    if (video.status !== 'completed') {
      return NextResponse.json(
        { error: 'La vidéo n\'est pas encore prête' },
        { status: 400 }
      )
    }

    // Vérifier qu'on a une URI GCS
    if (!video.gcsUri) {
      return NextResponse.json(
        { error: 'URI de la vidéo non disponible' },
        { status: 404 }
      )
    }

    try {
      // Vérifier que le fichier existe sur GCS
      const exists = await videoExistsOnGcs(video.gcsUri)
      if (!exists) {
        // Marquer la vidéo comme failed si le fichier n'existe pas
        await prisma.generatedVideo.update({
          where: { id },
          data: {
            status: 'failed',
            errorMessage: 'Le fichier vidéo n\'a pas été créé. Veuillez réessayer.',
          }
        })

        return NextResponse.json(
          { error: 'Le fichier vidéo n\'existe pas. La génération a probablement échoué.' },
          { status: 404 }
        )
      }

      // Streamer la vidéo depuis GCS
      const videoBuffer = await streamVideoFromGcs(video.gcsUri)

      return new NextResponse(videoBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoBuffer.length.toString(),
          'Content-Disposition': `inline; filename="video-${id}.mp4"`,
        },
      })
    } catch (veoError) {
      console.error('Error streaming video:', veoError)
      if (veoError instanceof VeoError) {
        return NextResponse.json(
          { error: veoError.message },
          { status: 500 }
        )
      }
      throw veoError
    }
  } catch (error) {
    console.error('Error downloading video:', error)
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    )
  }
}
