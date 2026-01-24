import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/videos
 * Liste toutes les vidéos générées
 */
export async function GET() {
  try {
    const videos = await prisma.generatedVideo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        source: {
          select: {
            id: true,
            originalName: true,
          }
        }
      }
    })

    const videosData = videos.map(v => ({
      id: v.id,
      sourceId: v.sourceId,
      prompt: v.prompt,
      aspectRatio: v.aspectRatio,
      duration: v.duration,
      resolution: v.resolution,
      status: v.status,
      operationId: v.operationId,
      gcsUri: v.gcsUri,
      errorMessage: v.errorMessage,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      source: v.source,
    }))

    return NextResponse.json(videosData)
  } catch (error) {
    console.error('Error fetching generated videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generated videos' },
      { status: 500 }
    )
  }
}
