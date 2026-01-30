/**
 * Service de validation IA des photos
 * Utilise Gemini Vision pour analyser la qualité et pertinence des photos
 */

import { GoogleGenAI } from '@google/genai'
import prisma from '@/lib/prisma'

export interface ValidationResult {
  score: number           // 0-1, score de qualité global
  approved: boolean       // true si score >= threshold
  reasoning: string       // Explication de la décision
  qualities: {
    composition: number   // 0-1
    lighting: number      // 0-1
    clarity: number       // 0-1
    relevance: number     // 0-1 (pertinence pour une influenceuse)
  }
  issues: string[]        // Problèmes détectés
}

/**
 * Analyse une photo avec Gemini Vision et retourne un score de qualité
 */
export async function validatePhoto(
  imageBase64: string,
  influencerId: string
): Promise<ValidationResult> {
  // Récupérer la clé API et le threshold
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

  const threshold = influencer?.settings?.validationThreshold ?? 0.7

  const genAI = new GoogleGenAI({ apiKey: apiKeySetting.value })

  const prompt = `Tu es un expert en photographie et marketing d'influence Instagram.
Analyse cette photo et évalue sa qualité pour être utilisée par une influenceuse IA.

Évalue les critères suivants sur une échelle de 0 à 1 :
1. **Composition** : Cadrage, règle des tiers, équilibre visuel
2. **Éclairage** : Qualité de la lumière, ombres, exposition
3. **Clarté** : Netteté, absence de flou, qualité technique
4. **Pertinence** : Adaptée pour une influenceuse lifestyle/mode (pose naturelle, environnement approprié)

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte avant/après) :
{
  "composition": 0.8,
  "lighting": 0.7,
  "clarity": 0.9,
  "relevance": 0.85,
  "issues": ["problème 1", "problème 2"],
  "reasoning": "Explication courte de l'évaluation"
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

    // Parser le JSON
    let parsed: {
      composition: number
      lighting: number
      clarity: number
      relevance: number
      issues: string[]
      reasoning: string
    }

    try {
      // Nettoyer le texte des éventuels backticks markdown
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleanText)
    } catch {
      console.error('[Validation] Failed to parse response:', text)
      // Fallback avec des valeurs par défaut
      return {
        score: 0.5,
        approved: false,
        reasoning: 'Impossible d\'analyser la photo',
        qualities: { composition: 0.5, lighting: 0.5, clarity: 0.5, relevance: 0.5 },
        issues: ['Erreur d\'analyse IA']
      }
    }

    // Calculer le score global (moyenne pondérée)
    const score = (
      parsed.composition * 0.2 +
      parsed.lighting * 0.2 +
      parsed.clarity * 0.3 +
      parsed.relevance * 0.3
    )

    return {
      score: Math.round(score * 100) / 100,
      approved: score >= threshold,
      reasoning: parsed.reasoning,
      qualities: {
        composition: parsed.composition,
        lighting: parsed.lighting,
        clarity: parsed.clarity,
        relevance: parsed.relevance
      },
      issues: parsed.issues || []
    }
  } catch (error) {
    console.error('[Validation] Error:', error)
    throw error
  }
}

/**
 * Valide un lot de photos et retourne les résultats
 */
export async function validatePhotoBatch(
  photos: { id: string; imageData: string }[],
  influencerId: string
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>()

  // Traiter séquentiellement pour éviter le rate limit
  for (const photo of photos) {
    try {
      const result = await validatePhoto(photo.imageData, influencerId)
      results.set(photo.id, result)

      // Petit délai entre les appels
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`[Validation] Error for photo ${photo.id}:`, error)
      results.set(photo.id, {
        score: 0,
        approved: false,
        reasoning: 'Erreur lors de la validation',
        qualities: { composition: 0, lighting: 0, clarity: 0, relevance: 0 },
        issues: ['Erreur de validation']
      })
    }
  }

  return results
}
