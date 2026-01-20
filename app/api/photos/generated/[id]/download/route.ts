import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/generated/[id]/download
 * Télécharge une image générée par son ID
 * Force le téléchargement avec les headers appropriés
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

    // Construire le chemin absolu du fichier
    const absolutePath = path.join(process.cwd(), 'public', generatedPhoto.localPath)

    // Lire le fichier
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(absolutePath)
    } catch {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      )
    }

    // Générer un nom de fichier propre pour le téléchargement
    const fileName = `photo_generated_${id}.jpg`

    // Retourner le fichier avec les headers de téléchargement
    // Conversion en Uint8Array pour compatibilité NextResponse
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
