import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/photos/[id]/approve
 * Approuver une photo (passer en status approved)
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
      data: { status: 'approved' }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving photo:', error)
    return NextResponse.json(
      { error: 'Failed to approve photo' },
      { status: 500 }
    )
  }
}
