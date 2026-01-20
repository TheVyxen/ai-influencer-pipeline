import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/photos/generated/[id]
 * Récupère une photo générée par son ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const photo = await prisma.generatedPhoto.findUnique({
      where: { id },
      include: {
        sourcePhoto: {
          select: {
            id: true,
            source: {
              select: { username: true }
            }
          }
        }
      }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(photo)
  } catch (error) {
    console.error('Error fetching generated photo:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generated photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/photos/generated/[id]
 * Supprime une photo générée par son ID
 * Compatible Vercel (pas de fichier à supprimer, tout est en base de données)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Vérifier que la photo existe
    const photo = await prisma.generatedPhoto.findUnique({
      where: { id }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Supprimer la photo de la base de données
    // (l'image est stockée en base64 dans imageData, pas sur le système de fichiers)
    await prisma.generatedPhoto.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting generated photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete generated photo' },
      { status: 500 }
    )
  }
}
