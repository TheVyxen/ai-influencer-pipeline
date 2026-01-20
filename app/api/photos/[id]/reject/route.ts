import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/photos/[id]/reject
 * Rejeter une photo (passer en status rejected)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Vérifier que la photo existe
    const photo = await prisma.sourcePhoto.findUnique({
      where: { id }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Mettre à jour le status
    const updated = await prisma.sourcePhoto.update({
      where: { id },
      data: { status: 'rejected' }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error rejecting photo:', error)
    return NextResponse.json(
      { error: 'Failed to reject photo' },
      { status: 500 }
    )
  }
}
