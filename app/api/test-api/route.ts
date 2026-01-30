import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/test-api
 * Teste la connexion à une API (Google AI, Wavespeed, Apify)
 */
export async function POST(request: NextRequest) {
  try {
    const { api } = await request.json()

    if (!api || !['google_ai', 'wavespeed', 'apify'].includes(api)) {
      return NextResponse.json(
        { error: 'API invalide' },
        { status: 400 }
      )
    }

    // Récupérer la clé API depuis les settings
    const keyName = `${api}_api_key`
    const setting = await prisma.appSettings.findUnique({
      where: { key: keyName }
    })

    if (!setting?.value) {
      return NextResponse.json(
        { success: false, error: 'Clé API non configurée' },
        { status: 200 }
      )
    }

    // Tester selon l'API
    switch (api) {
      case 'google_ai':
        return await testGoogleAI(setting.value)
      case 'wavespeed':
        return await testWavespeed(setting.value)
      case 'apify':
        return await testApify(setting.value)
      default:
        return NextResponse.json(
          { success: false, error: 'API non supportée' },
          { status: 200 }
        )
    }
  } catch (error) {
    console.error('Error testing API:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors du test' },
      { status: 200 }
    )
  }
}

/**
 * Test de la connexion Google AI (Gemini)
 */
async function testGoogleAI(apiKey: string) {
  try {
    // Tester avec l'endpoint des modèles
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { method: 'GET' }
    )

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'Connexion Google AI OK' })
    } else if (response.status === 400 || response.status === 401) {
      return NextResponse.json({ success: false, error: 'Clé API invalide' })
    } else {
      return NextResponse.json({ success: false, error: `Erreur ${response.status}` })
    }
  } catch (error) {
    console.error('Google AI test error:', error)
    return NextResponse.json({ success: false, error: 'Impossible de contacter Google AI' })
  }
}

/**
 * Test de la connexion Wavespeed
 */
async function testWavespeed(apiKey: string) {
  try {
    // Tester avec l'endpoint des modèles disponibles
    const response = await fetch('https://api.wavespeed.ai/api/v2/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'Connexion Wavespeed OK' })
    } else if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ success: false, error: 'Clé API invalide' })
    } else {
      return NextResponse.json({ success: false, error: `Erreur ${response.status}` })
    }
  } catch (error) {
    console.error('Wavespeed test error:', error)
    return NextResponse.json({ success: false, error: 'Impossible de contacter Wavespeed' })
  }
}

/**
 * Test de la connexion Apify
 */
async function testApify(apiKey: string) {
  try {
    // Tester avec l'endpoint user
    const response = await fetch('https://api.apify.com/v2/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({
        success: true,
        message: `Connexion Apify OK (${data.data?.username || 'utilisateur vérifié'})`
      })
    } else if (response.status === 401) {
      return NextResponse.json({ success: false, error: 'Clé API invalide' })
    } else {
      return NextResponse.json({ success: false, error: `Erreur ${response.status}` })
    }
  } catch (error) {
    console.error('Apify test error:', error)
    return NextResponse.json({ success: false, error: 'Impossible de contacter Apify' })
  }
}
