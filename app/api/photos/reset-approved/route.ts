import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/photos/reset-approved
 * Remet toutes les photos "approved" en "pending"
 * Route temporaire pour la migration du workflow
 */
export async function POST() {
  try {
    const result = await prisma.sourcePhoto.updateMany({
      where: { status: 'approved' },
      data: { status: 'pending' }
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} photo(s) remise(s) en attente`,
      count: result.count
    })
  } catch (error) {
    console.error('Error resetting approved photos:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation' },
      { status: 500 }
    )
  }
}
