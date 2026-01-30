import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/images/reference
 * Sert l'image de référence stockée en base64 dans Settings
 * Cette URL peut être utilisée par Wavespeed
 */
export async function GET() {
  try {
    // Récupérer l'image de référence depuis Settings
    const setting = await prisma.appSettings.findUnique({
      where: { key: 'reference_photo_base64' }
    })

    if (!setting?.value) {
      return NextResponse.json(
        { error: 'No reference photo configured' },
        { status: 404 }
      )
    }

    // Le format stocké est "data:image/jpeg;base64,..." ou juste le base64
    let base64Data = setting.value
    let mimeType = 'image/jpeg'

    // Extraire le type MIME si présent dans le data URL
    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        base64Data = matches[2]
      }
    }

    // Convertir le base64 en buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Retourner l'image avec le bon Content-Type
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 heure
      },
    })
  } catch (error) {
    console.error('Error serving reference image:', error)
    return NextResponse.json(
      { error: 'Failed to serve reference image' },
      { status: 500 }
    )
  }
}
