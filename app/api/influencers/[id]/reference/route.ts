import { NextRequest, NextResponse } from 'next/server'
import { getInfluencerById, updateReferencePhoto } from '@/lib/influencer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/influencers/[id]/reference
 * Récupère la photo de référence d'une influenceuse
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const influencer = await getInfluencerById(id)
    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    if (!influencer.referencePhotoData) {
      return NextResponse.json(
        { error: 'No reference photo' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      exists: true,
      data: influencer.referencePhotoData
    })
  } catch (error) {
    console.error('Error fetching reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reference photo' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/influencers/[id]/reference
 * Upload ou met à jour la photo de référence
 * Body: { imageData: string } (base64)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier que l'influenceuse existe
    const influencer = await getInfluencerById(id)
    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    if (!body.imageData || typeof body.imageData !== 'string') {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Valider que c'est une image base64 valide
    const base64Regex = /^data:image\/(jpeg|jpg|png|webp);base64,/
    if (!base64Regex.test(body.imageData)) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be JPEG, PNG, or WebP in base64.' },
        { status: 400 }
      )
    }

    // Mettre à jour la photo de référence
    await updateReferencePhoto(id, body.imageData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error uploading reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload reference photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/influencers/[id]/reference
 * Supprime la photo de référence
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Vérifier que l'influenceuse existe
    const influencer = await getInfluencerById(id)
    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    // Supprimer la photo de référence
    await updateReferencePhoto(id, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete reference photo' },
      { status: 500 }
    )
  }
}
