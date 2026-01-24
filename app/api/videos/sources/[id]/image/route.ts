import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/videos/sources/[id]/image
 * Sert l'image source en binaire pour affichage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const source = await prisma.videoSource.findUnique({
      where: { id },
      select: {
        imageData: true,
        mimeType: true,
      }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Image source non trouvée' },
        { status: 404 }
      )
    }

    // Convertir le base64 en buffer
    const imageBuffer = Buffer.from(source.imageData, 'base64')

    // Retourner l'image avec les bons headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': source.mimeType,
        'Cache-Control': 'public, max-age=31536000', // Cache 1 an
      }
    })
  } catch (error) {
    console.error('Error serving video source image:', error)
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}
