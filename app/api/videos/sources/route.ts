import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/videos/sources
 * Liste toutes les images sources uploadées pour la génération vidéo
 */
export async function GET() {
  try {
    const sources = await prisma.videoSource.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        createdAt: true,
        // Ne pas inclure imageData pour éviter de surcharger la réponse
      }
    })

    const sourcesData = sources.map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    }))

    return NextResponse.json(sourcesData)
  } catch (error) {
    console.error('Error fetching video sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video sources' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/videos/sources
 * Upload une nouvelle image source pour la génération vidéo
 * Body: FormData avec un champ "file" (image)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    // Vérifier le type MIME
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez JPEG, PNG ou WebP.' },
        { status: 400 }
      )
    }

    // Vérifier la taille (max 20MB comme requis par Veo)
    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Image trop volumineuse. Maximum 20MB.' },
        { status: 400 }
      )
    }

    // Convertir le fichier en base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // Créer l'entrée en base de données
    const source = await prisma.videoSource.create({
      data: {
        originalName: file.name,
        imageData: base64,
        mimeType: file.type,
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      ...source,
      createdAt: source.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Error uploading video source:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
