import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, access } from 'fs/promises'
import path from 'path'

const REFERENCE_DIR = path.join(process.cwd(), 'public', 'reference')
const REFERENCE_PATH_JPG = path.join(REFERENCE_DIR, 'model.jpg')
const REFERENCE_PATH_PNG = path.join(REFERENCE_DIR, 'model.png')

/**
 * GET /api/reference
 * Vérifie si une photo de référence existe
 */
export async function GET() {
  try {
    // Vérifier si le fichier jpg existe
    try {
      await access(REFERENCE_PATH_JPG)
      return NextResponse.json({
        exists: true,
        path: '/reference/model.jpg',
        format: 'jpg'
      })
    } catch {
      // Pas de jpg, vérifier png
    }

    // Vérifier si le fichier png existe
    try {
      await access(REFERENCE_PATH_PNG)
      return NextResponse.json({
        exists: true,
        path: '/reference/model.png',
        format: 'png'
      })
    } catch {
      // Pas de png non plus
    }

    return NextResponse.json({
      exists: false,
      path: null,
      format: null
    })
  } catch (error) {
    console.error('Error checking reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to check reference photo' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reference
 * Upload de la photo de référence du modèle
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPG or PNG.' },
        { status: 400 }
      )
    }

    // Déterminer l'extension
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg'
    const ext = isJpg ? 'jpg' : 'png'
    const filePath = path.join(REFERENCE_DIR, `model.${ext}`)

    // Supprimer l'ancien fichier s'il existe (autre format)
    try {
      if (isJpg) {
        await unlink(REFERENCE_PATH_PNG)
      } else {
        await unlink(REFERENCE_PATH_JPG)
      }
    } catch {
      // Fichier n'existe pas, c'est ok
    }

    // Sauvegarder le nouveau fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      path: `/reference/model.${ext}`,
      format: ext
    })
  } catch (error) {
    console.error('Error uploading reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload reference photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/reference
 * Supprime la photo de référence
 */
export async function DELETE() {
  try {
    // Essayer de supprimer les deux formats
    try {
      await unlink(REFERENCE_PATH_JPG)
    } catch {
      // Fichier n'existe pas
    }

    try {
      await unlink(REFERENCE_PATH_PNG)
    } catch {
      // Fichier n'existe pas
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reference photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete reference photo' },
      { status: 500 }
    )
  }
}
