import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { describePhoto, GoogleAIError } from '@/lib/google-ai'

/**
 * POST /api/photos/[id]/describe
 * Génère un prompt de description via Google AI Gemini
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

    // Vérifier qu'on a un chemin local
    if (!photo.localPath) {
      return NextResponse.json(
        { error: 'Photo file not found' },
        { status: 400 }
      )
    }

    // Charger l'image depuis le système de fichiers
    const imagePath = path.join(process.cwd(), 'public', photo.localPath)
    let imageBuffer: Buffer

    try {
      imageBuffer = await readFile(imagePath)
    } catch {
      return NextResponse.json(
        { error: 'Unable to read image file' },
        { status: 500 }
      )
    }

    // Déterminer le type MIME
    const ext = path.extname(photo.localPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const mimeType = mimeTypes[ext] || 'image/jpeg'

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
