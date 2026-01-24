import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/videos/sources/[id]
 * Récupère une image source spécifique (avec imageData pour preview)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const source = await prisma.videoSource.findUnique({
      where: { id },
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Image source non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: source.id,
      originalName: source.originalName,
      mimeType: source.mimeType,
      imageData: source.imageData,
      createdAt: source.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Error fetching video source:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video source' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/videos/sources/[id]
 * Supprime une image source et toutes ses vidéos générées associées
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Vérifier que la source existe
    const source = await prisma.videoSource.findUnique({
      where: { id },
      include: {
        generatedVideos: {
          select: { id: true, gcsUri: true }
        }
      }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Image source non trouvée' },
        { status: 404 }
      )
    }

    // Supprimer les vidéos GCS associées si nécessaire
    // Note: Le nettoyage GCS peut être fait en background via une tâche cron
    // Pour l'instant on supprime juste les entrées BDD

    // Supprimer la source (cascade supprime les GeneratedVideo associées)
    await prisma.videoSource.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video source:', error)
    return NextResponse.json(
      { error: 'Failed to delete video source' },
      { status: 500 }
    )
  }
}
