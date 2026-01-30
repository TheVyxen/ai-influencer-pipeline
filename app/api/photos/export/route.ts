import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/photos/export
 * Exporte les photos sélectionnées vers le dossier ready-to-post pour automation Clawdbot
 */
export async function POST(request: Request) {
  try {
    const { photoIds } = await request.json()

    if (!photoIds || !Array.isArray(photoIds)) {
      return NextResponse.json(
        { error: 'photoIds array is required' },
        { status: 400 }
      )
    }

    // Récupérer les photos sélectionnées
    const photos = await prisma.generatedPhoto.findMany({
      where: {
        id: { in: photoIds }
      },
      include: {
        sourcePhoto: {
          include: {
            source: {
              select: { username: true }
            }
          }
        }
      }
    })

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos found' },
        { status: 404 }
      )
    }

    // Créer le dossier ready-to-post s'il n'existe pas
    const readyToPostDir = path.join(process.cwd(), 'public', 'generated', 'ready-to-post')
    if (!fs.existsSync(readyToPostDir)) {
      fs.mkdirSync(readyToPostDir, { recursive: true })
    }

    const exportedPhotos = []

    for (const photo of photos) {
      try {
        let sourceImagePath = ''
        
        // Gérer les données d'image (base64 ou localPath)
        if (photo.imageData) {
          // Image stockée en base64
          const imageBuffer = Buffer.from(photo.imageData.split(',')[1], 'base64')
          sourceImagePath = path.join(process.cwd(), 'temp-export.jpg')
          fs.writeFileSync(sourceImagePath, imageBuffer)
        } else if (photo.localPath) {
          // Image stockée localement
          sourceImagePath = path.join(process.cwd(), photo.localPath)
        } else {
          console.warn(`Skipping photo ${photo.id}: no image data`)
          continue
        }

        // Générer le nom de fichier pour l'export
        const timestamp = new Date().getTime()
        const sourceUsername = photo.sourcePhoto?.source?.username || 'unknown'
        const fileName = `${timestamp}_${sourceUsername}_${photo.id}.jpg`
        const exportPath = path.join(readyToPostDir, fileName)

        // Copier l'image
        if (fs.existsSync(sourceImagePath)) {
          fs.copyFileSync(sourceImagePath, exportPath)
          
          // Nettoyer le fichier temporaire si créé
          if (photo.imageData && sourceImagePath.includes('temp-export')) {
            fs.unlinkSync(sourceImagePath)
          }

          // Créer le fichier metadata associé
          const metadata = {
            id: photo.id,
            prompt: photo.prompt,
            sourceUsername: sourceUsername,
            isCarousel: photo.isCarousel,
            carouselId: photo.carouselId,
            carouselIndex: photo.carouselIndex,
            carouselTotal: photo.carouselTotal,
            createdAt: photo.createdAt,
            originalInstagramUrl: photo.sourcePhoto?.instagramPostUrl,
            exportedAt: new Date().toISOString()
          }

          const metadataPath = path.join(readyToPostDir, `${fileName}.meta.json`)
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

          exportedPhotos.push({
            id: photo.id,
            fileName: fileName,
            exportPath: `/generated/ready-to-post/${fileName}`,
            metadataPath: `/generated/ready-to-post/${fileName}.meta.json`
          })
        }
      } catch (error) {
        console.error(`Error exporting photo ${photo.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      exported: exportedPhotos.length,
      total: photos.length,
      photos: exportedPhotos
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/photos/export
 * Liste les photos prêtes pour posting
 */
export async function GET() {
  try {
    const readyToPostDir = path.join(process.cwd(), 'public', 'generated', 'ready-to-post')
    
    if (!fs.existsSync(readyToPostDir)) {
      return NextResponse.json({ photos: [] })
    }

    const files = fs.readdirSync(readyToPostDir)
    const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    
    const photos = imageFiles.map(fileName => {
      const metadataPath = path.join(readyToPostDir, `${fileName}.meta.json`)
      let metadata = {}
      
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        } catch (error) {
          console.warn(`Invalid metadata for ${fileName}`)
        }
      }

      return {
        fileName,
        imagePath: `/generated/ready-to-post/${fileName}`,
        metadataPath: fs.existsSync(metadataPath) ? `/generated/ready-to-post/${fileName}.meta.json` : null,
        metadata,
        stats: fs.statSync(path.join(readyToPostDir, fileName))
      }
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('List ready-to-post error:', error)
    return NextResponse.json(
      { error: 'Failed to list ready photos' },
      { status: 500 }
    )
  }
}