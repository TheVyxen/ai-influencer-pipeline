/**
 * Service de génération de captions Instagram
 * Utilise Gemini pour générer des captions personnalisées selon le style de l'influenceuse
 */

import { GoogleGenAI } from '@google/genai'
import prisma from '@/lib/prisma'

export interface CaptionResult {
  caption: string
  hashtags: string[]
  alternativeCaption?: string
}

export interface CaptionSettings {
  tone: 'friendly' | 'professional' | 'casual' | 'luxury'
  length: 'short' | 'medium' | 'long'
  useEmojis: boolean
  hashtagCount: number
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  friendly: 'amical, chaleureux, accessible, comme une amie qui partage sa vie',
  professional: 'professionnel, élégant, sophistiqué, inspirant confiance',
  casual: 'décontracté, spontané, authentique, sans prise de tête',
  luxury: 'luxueux, exclusif, aspirationnel, haut de gamme'
}

const LENGTH_GUIDELINES: Record<string, string> = {
  short: '1-2 phrases courtes (max 100 caractères)',
  medium: '2-3 phrases (100-200 caractères)',
  long: '3-5 phrases avec storytelling (200-400 caractères)'
}

/**
 * Génère une caption Instagram pour une photo
 */
export async function generateCaption(
  imageBase64: string,
  imageDescription: string,
  influencerId: string
): Promise<CaptionResult> {
  // Récupérer la configuration
  const [apiKeySetting, influencer] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: 'google_ai_api_key' } }),
    prisma.influencer.findUnique({
      where: { id: influencerId },
      include: { settings: true }
    })
  ])

  if (!apiKeySetting?.value) {
    throw new Error('Google AI API key not configured')
  }

  const settings: CaptionSettings = {
    tone: (influencer?.settings?.captionTone as CaptionSettings['tone']) || 'friendly',
    length: (influencer?.settings?.captionLength as CaptionSettings['length']) || 'medium',
    useEmojis: influencer?.settings?.captionEmojis ?? true,
    hashtagCount: influencer?.settings?.hashtagCount ?? 5
  }

  const influencerName = influencer?.name || 'l\'influenceuse'

  const genAI = new GoogleGenAI({ apiKey: apiKeySetting.value })

  const prompt = `Tu es ${influencerName}, une influenceuse IA sur Instagram.
Tu dois écrire une caption pour cette photo.

**Ton style :** ${TONE_DESCRIPTIONS[settings.tone]}
**Longueur :** ${LENGTH_GUIDELINES[settings.length]}
**Emojis :** ${settings.useEmojis ? 'Utilise des emojis de façon naturelle' : 'Pas d\'emojis'}
**Hashtags :** Génère exactement ${settings.hashtagCount} hashtags pertinents

**Description de la photo :**
${imageDescription}

Réponds UNIQUEMENT avec un JSON valide (pas de markdown) :
{
  "caption": "Ta caption ici",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "alternativeCaption": "Une version alternative de la caption"
}`

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
              }
            }
          ]
        }
      ]
    })

    const text = response.text?.trim() || ''

    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanText)

      // S'assurer que les hashtags commencent par #
      const hashtags = (parsed.hashtags || []).map((tag: string) =>
        tag.startsWith('#') ? tag : `#${tag}`
      )

      return {
        caption: parsed.caption,
        hashtags,
        alternativeCaption: parsed.alternativeCaption
      }
    } catch {
      console.error('[Captions] Failed to parse response:', text)
      // Fallback basique
      return {
        caption: 'Nouvelle photo disponible !',
        hashtags: ['#lifestyle', '#instagood', '#photooftheday', '#mood', '#vibes']
      }
    }
  } catch (error) {
    console.error('[Captions] Error:', error)
    throw error
  }
}

/**
 * Génère des captions pour un lot de photos
 */
export async function generateCaptionBatch(
  photos: { id: string; imageData: string; description: string }[],
  influencerId: string
): Promise<Map<string, CaptionResult>> {
  const results = new Map<string, CaptionResult>()

  for (const photo of photos) {
    try {
      const result = await generateCaption(photo.imageData, photo.description, influencerId)
      results.set(photo.id, result)

      // Délai entre les appels
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`[Captions] Error for photo ${photo.id}:`, error)
      results.set(photo.id, {
        caption: 'Nouvelle photo !',
        hashtags: ['#lifestyle', '#instagood', '#photooftheday']
      })
    }
  }

  return results
}
