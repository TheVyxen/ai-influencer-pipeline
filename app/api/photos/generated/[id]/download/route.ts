import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/generated/[id]/download
 * Télécharge une image générée par son ID
 * Force le téléchargement avec les headers appropriés
 * Compatible Vercel (lit depuis la base de données)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer la photo générée
    const generatedPhoto = await prisma.generatedPhoto.findUnique({
      where: { id }
    })

    if (!generatedPhoto) {
      return NextResponse.json(
        { error: 'Photo not found' },
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

    // Extraire le base64 pur si c'est un data URL
    let base64Data = generatedPhoto.imageData
    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:[^;]+;base64,(.+)$/)
      if (matches) {
        base64Data = matches[1]
      }
    }

    // Convertir en buffer
    const fileBuffer = Buffer.from(base64Data, 'base64')

    // Générer un nom de fichier propre pour le téléchargement
    const fileName = `photo_generated_${id}.jpg`

    // Retourner le fichier avec les headers de téléchargement
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading photo:', error)
    return NextResponse.json(
      { error: 'Error downloading photo' },
      { status: 500 }
    )
  }
}
