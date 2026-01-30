import { NextRequest, NextResponse } from 'next/server'
import { getTemporaryImage, deleteTemporaryImage } from '@/lib/instagram/media'

/**
 * GET /api/media/[token]
 * Sert une image temporaire (pour Instagram Graph API)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const imageBase64 = await getTemporaryImage(token)

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image not found or expired' },
        { status: 404 }
      )
    }

    // Convertir base64 en buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Détecter le type d'image (par défaut JPEG)
    let contentType = 'image/jpeg'
    if (imageBase64.startsWith('iVBORw0KGgo')) {
      contentType = 'image/png'
    } else if (imageBase64.startsWith('R0lGOD')) {
      contentType = 'image/gif'
    } else if (imageBase64.startsWith('UklGR')) {
      contentType = 'image/webp'
    }

    // Retourner l'image
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      }
    })
  } catch (error) {
    console.error('Error serving temporary image:', error)
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/media/[token]
 * Supprime une image temporaire
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    await deleteTemporaryImage(token)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting temporary image:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}
