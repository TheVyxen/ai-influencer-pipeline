import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * DELETE /api/sources/[id]
 * Supprimer une source Instagram
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Vérifier que la source existe
    const source = await prisma.source.findUnique({
      where: { id }
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // Supprimer la source (cascade supprime les photos associées)
    await prisma.source.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting source:', error)
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    )
  }
}
