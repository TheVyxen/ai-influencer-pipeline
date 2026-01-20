import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { describePhoto, GoogleAIError } from '@/lib/google-ai'

/**
 * Télécharge une image depuis une URL et retourne le buffer
 */
async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * POST /api/photos/[id]/describe
 * Génère un prompt de description via Google AI Gemini
 * Télécharge l'image depuis originalUrl (compatible Vercel serverless)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer la photo
    const photo = await prisma.sourcePhoto.findUnique({
      where: { id }
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Vérifier que la photo est approuvée
    if (photo.status !== 'approved') {
      return NextResponse.json(
        { error: 'Photo must be approved before describing' },
        { status: 400 }
      )
    }

    // Vérifier qu'on a une URL originale
    if (!photo.originalUrl) {
      return NextResponse.json(
        { error: 'Photo URL not found' },
        { status: 400 }
      )
    }

    // Télécharger l'image depuis l'URL originale (Instagram)
    let imageBuffer: Buffer
    try {
      imageBuffer = await downloadImageFromUrl(photo.originalUrl)
    } catch (error) {
      console.error('Error downloading image from URL:', error)
      return NextResponse.json(
        { error: 'Unable to download image from source URL' },
        { status: 500 }
      )
    }

    // Déterminer le type MIME depuis l'URL ou utiliser jpeg par défaut
    const url = photo.originalUrl.toLowerCase()
    let mimeType = 'image/jpeg'
    if (url.includes('.png')) {
      mimeType = 'image/png'
    } else if (url.includes('.webp')) {
      mimeType = 'image/webp'
    } else if (url.includes('.gif')) {
      mimeType = 'image/gif'
    }

    // Appeler Google AI pour générer le prompt
    const generatedPrompt = await describePhoto(imageBuffer, mimeType)

    // Sauvegarder le prompt en base
    const updated = await prisma.sourcePhoto.update({
      where: { id },
      data: { generatedPrompt }
    })

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt,
      photo: updated
    })
  } catch (error) {
    console.error('Error describing photo:', error)

    // Gérer les erreurs Google AI spécifiques
    if (error instanceof GoogleAIError) {
      const statusCodes: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'RATE_LIMIT': 429,
        'INVALID_IMAGE': 400,
        'CONNECTION_ERROR': 503,
        'UNKNOWN': 500,
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to describe photo' },
      { status: 500 }
    )
  }
}
