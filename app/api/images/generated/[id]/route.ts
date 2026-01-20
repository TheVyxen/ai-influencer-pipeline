import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/images/generated/[id]
 * Sert une image générée stockée en base64 dans la base de données
 * Cette URL peut être utilisée par Wavespeed ou pour l'affichage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer l'image générée depuis la base de données
    const generatedPhoto = await prisma.generatedPhoto.findUnique({
      where: { id }
    })

    if (!generatedPhoto) {
      return NextResponse.json(
        { error: 'Generated photo not found' },
        { status: 404 }
      )
    }

    // Vérifier qu'on a des données d'image
    if (!generatedPhoto.imageData) {
      return NextResponse.json(
        { error: 'No image data available' },
        { status: 404 }
      )
    }

    // Le format stocké est "data:image/jpeg;base64,..." ou juste le base64
    let base64Data = generatedPhoto.imageData
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
        'Cache-Control': 'public, max-age=86400', // Cache 24 heures
        'Content-Disposition': `inline; filename="generated_${id}.jpg"`,
      },
    })
  } catch (error) {
    console.error('Error serving generated image:', error)
    return NextResponse.json(
      { error: 'Failed to serve generated image' },
      { status: 500 }
    )
  }
}
