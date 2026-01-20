import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { generateFileName } from '@/lib/utils'

/**
 * POST /api/photos/upload
 * Upload manuel d'une photo (simule le scraping)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceId = formData.get('sourceId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      )
    }

    // Vérifier que la source existe
    const source = await prisma.source.findUnique({
      where: { id: sourceId }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // Récupérer l'extension du fichier
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = generateFileName(ext)
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName)

    // Convertir le fichier en buffer et sauvegarder
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Créer l'entrée en base
    const photo = await prisma.sourcePhoto.create({
      data: {
        sourceId,
        originalUrl: `/uploads/${fileName}`,
        localPath: `/uploads/${fileName}`,
        status: 'pending'
      },
      include: {
        source: {
          select: { username: true }
        }
      }
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}
