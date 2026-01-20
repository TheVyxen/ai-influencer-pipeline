import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import prisma from '@/lib/prisma'

/**
 * POST /api/photos/generated/download-all
 * Crée un ZIP avec les photos sélectionnées
 * Body: { ids: string[] }
 * Compatible Vercel (lit depuis la base de données)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No photo IDs provided' },
        { status: 400 }
      )
    }

    // Récupérer les photos de la base de données
    const photos = await prisma.generatedPhoto.findMany({
      where: {
        id: { in: ids }
      }
    })

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos found' },
        { status: 404 }
      )
    }

    // Filtrer les photos qui ont des données d'image
    const validPhotos = photos.filter(p => p.imageData)

    if (validPhotos.length === 0) {
      return NextResponse.json(
        { error: 'No valid photos found' },
        { status: 404 }
      )
    }

    // Créer le ZIP en mémoire avec un stream
    const chunks: Buffer[] = []

    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 5 } // Niveau de compression moyen
      })

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      archive.on('error', (err) => {
        reject(err)
      })

      archive.on('end', () => {
        resolve()
      })

      // Ajouter chaque photo au ZIP
      for (const photo of validPhotos) {
        // Extraire le base64 pur si c'est un data URL
        let base64Data = photo.imageData!
        if (base64Data.startsWith('data:')) {
          const matches = base64Data.match(/^data:[^;]+;base64,(.+)$/)
          if (matches) {
            base64Data = matches[1]
          }
        }

        // Convertir en buffer
        const imageBuffer = Buffer.from(base64Data, 'base64')
        const fileName = `photo_generated_${photo.id}.jpg`
        archive.append(imageBuffer, { name: fileName })
      }

      // Finaliser le ZIP
      archive.finalize()
    })

    // Combiner les chunks en un seul buffer
    const zipBuffer = Buffer.concat(chunks)

    // Générer un nom de fichier avec la date
    const timestamp = new Date().toISOString().slice(0, 10)
    const fileName = `photos_generated_${timestamp}.zip`

    // Retourner le ZIP avec les headers appropriés
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error creating ZIP:', error)
    return NextResponse.json(
      { error: 'Error creating ZIP archive' },
      { status: 500 }
    )
  }
}
