import { NextResponse } from 'next/server'

/**
 * Proxy pour les images externes (Instagram via Apify)
 * Contourne les restrictions CORS en récupérant l'image côté serveur
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        // User-Agent pour éviter les blocages
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erreur fetch: ${response.status}` },
        { status: response.status }
      )
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 heure
      },
    })
  } catch (error) {
    console.error('Proxy image error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'image' },
      { status: 500 }
    )
  }
}
