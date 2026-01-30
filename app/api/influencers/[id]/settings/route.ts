import { NextRequest, NextResponse } from 'next/server'
import {
  getInfluencerById,
  getInfluencerSettings,
  updateInfluencerSettings
} from '@/lib/influencer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/influencers/[id]/settings
 * Récupère les settings d'une influenceuse
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const settings = await getInfluencerSettings(id)

    // Retourner les settings ou un objet vide avec les valeurs par défaut
    return NextResponse.json(settings || {
      imageProvider: 'gemini',
      imageAspectRatio: '9:16',
      imageSize: '2K',
      postsPerScrape: 10,
      autoScrapeEnabled: false,
      autoScrapeInterval: 24,
      captionTone: 'friendly',
      captionLength: 'medium',
      captionEmojis: true,
      hashtagCount: 5,
      validationThreshold: 0.7,
      postsPerDay: 1
    })
  } catch (error) {
    console.error('Error fetching influencer settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/influencers/[id]/settings
 * Met à jour les settings d'une influenceuse
 * Body: { imageProvider?, imageAspectRatio?, imageSize?, ... }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Validation des valeurs
    if (body.imageProvider && !['gemini', 'wavespeed'].includes(body.imageProvider)) {
      return NextResponse.json(
        { error: 'Invalid image provider' },
        { status: 400 }
      )
    }

    if (body.imageAspectRatio && !['9:16', '1:1', '16:9'].includes(body.imageAspectRatio)) {
      return NextResponse.json(
        { error: 'Invalid aspect ratio' },
        { status: 400 }
      )
    }

    if (body.imageSize && !['1K', '2K', '4K'].includes(body.imageSize)) {
      return NextResponse.json(
        { error: 'Invalid image size' },
        { status: 400 }
      )
    }

    if (body.captionTone && !['friendly', 'professional', 'casual', 'luxury'].includes(body.captionTone)) {
      return NextResponse.json(
        { error: 'Invalid caption tone' },
        { status: 400 }
      )
    }

    if (body.captionLength && !['short', 'medium', 'long'].includes(body.captionLength)) {
      return NextResponse.json(
        { error: 'Invalid caption length' },
        { status: 400 }
      )
    }

    // Mettre à jour les settings
    const settings = await updateInfluencerSettings(id, body)

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating influencer settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
