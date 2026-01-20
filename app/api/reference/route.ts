import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/reference
 * Vérifie si une photo de référence existe dans la base de données
 */
export async function GET() {
  try {
    // Vérifier si l'image de référence existe dans Settings
    const setting = await prisma.settings.findUnique({
      where: { key: 'reference_photo_base64' }
    })

    if (setting?.value) {
      // Récupérer le format depuis Settings (optionnel)
      const formatSetting = await prisma.settings.findUnique({
        where: { key: 'reference_photo_format' }
      })

      return NextResponse.json({
        exists: true,
        path: '/api/images/reference', // URL pour accéder à l'image
        format: formatSetting?.value || 'jpg'
      })
    }

    return NextResponse.json({
      exists: false,
      path: null,
      format: null
    })
  } catch (error) {
    console.error('Error checking reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to check reference photo' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reference
 * Upload de la photo de référence du modèle (stockée en base64 dans Settings)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPG or PNG.' },
        { status: 400 }
      )
    }

    // Vérifier la taille du fichier (max 5MB pour éviter les problèmes de base de données)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Déterminer l'extension
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg'
    const ext = isJpg ? 'jpg' : 'png'
    const mimeType = isJpg ? 'image/jpeg' : 'image/png'

    // Convertir le fichier en base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`

    // Sauvegarder dans Settings (upsert)
    await prisma.settings.upsert({
      where: { key: 'reference_photo_base64' },
      update: { value: base64Data },
      create: { key: 'reference_photo_base64', value: base64Data }
    })

    // Sauvegarder le format
    await prisma.settings.upsert({
      where: { key: 'reference_photo_format' },
      update: { value: ext },
      create: { key: 'reference_photo_format', value: ext }
    })

    return NextResponse.json({
      success: true,
      path: '/api/images/reference',
      format: ext
    })
  } catch (error) {
    console.error('Error uploading reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload reference photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/reference
 * Supprime la photo de référence de la base de données
 */
export async function DELETE() {
  try {
    // Supprimer l'image de référence et son format
    await prisma.settings.deleteMany({
      where: {
        key: {
          in: ['reference_photo_base64', 'reference_photo_format']
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete reference photo' },
      { status: 500 }
    )
  }
}
