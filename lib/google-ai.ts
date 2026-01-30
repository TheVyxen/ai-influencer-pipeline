/**
 * Service Google AI / Gemini pour la description et génération de photos
 * - Description: gemini-3-pro-preview (avec thinking_level: "low")
 * - Génération: gemini-3-pro-image-preview
 * IMPORTANT: Ne jamais décrire le physique de la personne
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import prisma from './prisma'

/**
 * Récupère la clé API Google AI (depuis env ou Settings)
 */
async function getApiKey(): Promise<string | null> {
  // D'abord vérifier les variables d'environnement
  if (process.env.GOOGLE_AI_API_KEY) {
    return process.env.GOOGLE_AI_API_KEY
  }

  // Sinon chercher dans les Settings
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: 'google_ai_api_key' }
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * Prompt système pour Gemini - décrit exactement comment générer le prompt
 * Version détaillée avec règles strictes pour la génération photo-réaliste
 */
const SYSTEM_PROMPT = `Tu es mon assistant expert en prompt engineering, orienté résultat, précision et rigueur. Ton rôle principal est de décrire des images pour en faire des prompts de génération de photos, dans un workflow ultra opérationnel. Je ne veux pas de discussion inutile. Je veux des prompts prêts à copier-coller, cohérents, détaillés, et reproductibles.

Langue et style.
Réponds uniquement en anglais. Ton ton est direct, professionnel, efficace. Tu vas droit au but. Tu évites les validations inutiles. Tu respectes une contrainte typographique stricte: n'utilise jamais de tiret cadratin. Remplace les tirets cadratins par un point ou une virgule selon le sens.

Règle de base pour les prompts.
Chaque prompt doit commencer exactement par cette phrase, avec la même ponctuation et l'espace final:
Preserve the identity of the person from the input image.
Après cette phrase, tu décris précisément tout le reste de l'image, mais tu ne décris jamais les caractéristiques physiques de la fille. Tu ne décris pas le visage, le corps, l'âge, la morphologie, la couleur de peau, les traits, ni aucun détail biométrique. À la place, tu insistes sur le fait que c'est la même personne que l'image d'entrée, à identité strictement préservée. Tu peux décrire la posture, la position, l'attitude, la vibe, et l'expression générale sans entrer dans des traits physiques.

Ce que tu dois décrire avec précision.
Tu décris systématiquement, de façon exhaustive et claire:
1. Le décor et l'environnement: lieu, arrière-plan, objets, matériaux, couleurs, ambiance, éléments de contexte.
2. La tenue et les accessoires: type de vêtements, matières, couleurs, coupe, détails visibles, bijoux, sacs, objets tenus, éléments de style.
3. La position et la pose: orientation du corps, placement des bras et des mains, position des jambes, inclinaison de la tête, point de vue et angle de prise de vue.
4. La caméra et la composition: cadrage, distance, perspective, angle, profondeur de champ, rendu photo réaliste, qualité, netteté, style photo, réalisme des textures.
5. L'éclairage et l'ambiance lumineuse, sauf règle spéciale ci dessous.
6. Le mood: ambiance émotionnelle, énergie, contexte lifestyle, sans sexualisation explicite ni contenu extrême.

Règle spéciale sur la lumière et le selfie.
Ne mentionne pas la lumière du téléphone, le flash du téléphone, ni un téléphone visible si cela risque de faire apparaître un téléphone dans la main au lieu d'un rendu selfie. Pour les selfies, décris plutôt un rendu selfie crédible via: angle à bout de bras, perspective naturelle, cadrage, et lumière ambiante de la pièce ou du lieu. Tu peux parler de lumière douce, ambiante, néon, indoor, daylight, etc. Tu évites les formulations qui imposent un téléphone ou un flash visible.

Contraintes de contenu.
Tu restes photo réaliste. Tu évites les filtres, la stylisation artistique, les effets de beauté, la retouche artificielle. Tu demandes une image haute résolution, textures naturelles, rendu authentique.
Tu restes safe. Pas de nudité explicite. Pas de contenu extrême. Tu restes dans un registre lingerie ou tenue lifestyle si l'image le montre, mais toujours en description factuelle et non explicite.
Tu ne fais pas de supposition non visible. Tu ne changes pas la scène. Tu ne rajoutes pas des éléments non présents.

Comportement attendu.
Tu travailles comme un spécialiste qui maîtrise les détails qui font réussir une génération. Tu es attentif aux pièges de génération. Par exemple. Mentionner "flash du téléphone" peut créer un téléphone. Tu anticipes ces problèmes et tu ajustes.
Tu es cohérent entre les images d'une même série. Tu utilises un vocabulaire stable. Tu évites les contradictions.

Tu produis uniquement le prompt, sans commentaire, sans explication, sans introduction. Juste le prompt prêt à l'emploi.`

/**
 * Vérifie si la clé API Google AI est configurée
 */
export async function isGoogleAIConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  return Boolean(apiKey && apiKey.length > 0)
}

/**
 * Types d'erreurs possibles
 */
export class GoogleAIError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'RATE_LIMIT' | 'INVALID_IMAGE' | 'CONTENT_BLOCKED' | 'TIMEOUT' | 'CONNECTION_ERROR' | 'GENERATION_FAILED' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'GoogleAIError'
  }
}

/**
 * Génère un prompt de description d'image via Gemini 3 Pro Vision
 * @param imageBuffer - Buffer de l'image à analyser
 * @param mimeType - Type MIME de l'image (ex: 'image/jpeg')
 * @returns Le prompt complet généré par Gemini
 */
export async function describePhoto(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new GoogleAIError(
      'Configurez votre clé Google AI dans Settings',
      'NOT_CONFIGURED'
    )
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Convertir le buffer en base64 pour l'API
    const base64Image = imageBuffer.toString('base64')

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT + '\n\nAnalyse cette image et génère le prompt.' },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              }
            }
          ]
        }
      ],
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW, // Pas besoin de raisonnement complexe pour décrire une image
        }
      },
    })

    // Extraire le texte de la réponse
    const text = response.candidates?.[0]?.content?.parts?.find(
      (part: { text?: string }) => part.text
    )?.text

    if (!text || text.trim().length === 0) {
      throw new GoogleAIError(
        'Impossible d\'analyser cette image',
        'INVALID_IMAGE'
      )
    }

    return text.trim()
  } catch (error) {
    // Gérer les erreurs spécifiques
    if (error instanceof GoogleAIError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      throw new GoogleAIError(
        'Trop de requêtes, réessayez dans quelques secondes',
        'RATE_LIMIT'
      )
    }

    // Contenu bloqué
    if (errorMessage.includes('blocked') || errorMessage.includes('safety') || errorMessage.includes('HARM')) {
      throw new GoogleAIError(
        'L\'image a été bloquée par les filtres de sécurité',
        'CONTENT_BLOCKED'
      )
    }

    // Erreur de connexion
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      throw new GoogleAIError(
        'Erreur de connexion à Google AI',
        'CONNECTION_ERROR'
      )
    }

    // Image invalide
    if (errorMessage.includes('image') || errorMessage.includes('INVALID')) {
      throw new GoogleAIError(
        'Impossible d\'analyser cette image',
        'INVALID_IMAGE'
      )
    }

    // Erreur générique
    throw new GoogleAIError(
      `Erreur Google AI: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}

/**
 * Parse la réponse de Gemini pour extraire les prompts individuels
 * Cherche les patterns "Prompt 1:", "Prompt 2:", etc.
 * @param response - La réponse brute de Gemini
 * @param expectedCount - Nombre de prompts attendus
 * @returns Tableau de prompts extraits
 */
function parseCarouselPrompts(response: string, expectedCount: number): string[] {
  const prompts: string[] = []

  // Pattern pour trouver "Prompt N:" ou "Prompt N :" suivi du contenu
  // Le contenu va jusqu'au prochain "Prompt N:" ou la fin du texte
  const promptPattern = /Prompt\s*(\d+)\s*[:\-]\s*/gi

  // Trouver toutes les positions des "Prompt N:"
  const matches: { index: number; num: number }[] = []
  let match

  while ((match = promptPattern.exec(response)) !== null) {
    matches.push({
      index: match.index + match[0].length,
      num: parseInt(match[1])
    })
  }

  if (matches.length === 0) {
    // Si pas de structure "Prompt N:", essayer de retourner la réponse entière comme un seul prompt
    console.warn('No "Prompt N:" structure found in response, returning as single prompt')
    return [response.trim()]
  }

  // Extraire le contenu entre chaque "Prompt N:"
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index
    const endIndex = i + 1 < matches.length
      ? response.lastIndexOf('Prompt', matches[i + 1].index - 1)
      : response.length

    const promptContent = response.substring(startIndex, endIndex).trim()
    prompts[matches[i].num - 1] = promptContent // -1 car les prompts sont numérotés à partir de 1
  }

  // Vérifier qu'on a tous les prompts attendus
  const result: string[] = []
  for (let i = 0; i < expectedCount; i++) {
    if (prompts[i]) {
      result.push(prompts[i])
    } else {
      console.warn(`Missing prompt ${i + 1} in response`)
      result.push('')
    }
  }

  return result
}

/**
 * Décrit un carrousel de photos en une seule requête API
 * Toutes les images sont envoyées ensemble, Gemini retourne des prompts structurés
 * Image 1 : description complète (décor, tenue, éclairage, pose, style)
 * Images 2+ : format court, uniquement le changement de pose
 * @param imageBuffers - Tableau de Buffers des images à analyser
 * @returns Tableau de prompts (un par image)
 */
export async function describeCarouselPhotos(
  imageBuffers: Buffer[]
): Promise<string[]> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new GoogleAIError(
      'Configurez votre clé Google AI dans Settings',
      'NOT_CONFIGURED'
    )
  }

  if (imageBuffers.length === 0) {
    return []
  }

  // Si une seule image, utiliser describePhoto directement
  if (imageBuffers.length === 1) {
    const prompt = await describePhoto(imageBuffers[0], 'image/jpeg')
    return [prompt]
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Construire le prompt système pour le carrousel
    const carouselSystemPrompt = `${SYSTEM_PROMPT}

=== INSTRUCTIONS POUR PLUSIEURS IMAGES ===

Tu reçois ${imageBuffers.length} images d'une même scène. Tu dois produire ${imageBuffers.length} prompts.

RÈGLES STRICTES:
1. Prompt 1 = description COMPLÈTE de la première image (décor, tenue, éclairage, pose, style, qualité)
2. Prompts 2, 3, 4... = format COURT, uniquement le changement de pose

FORMAT DE SORTIE OBLIGATOIRE:

Prompt 1:
[Description complète ici]

Prompt 2:
Preserve the identity of the person from the input image. Same scene, same outfit, same lighting, same environment. Only the pose changes: [description de la pose en 1-2 phrases]. Ultra-realistic, identical setting preserved.

Prompt 3:
Preserve the identity of the person from the input image. Same scene, same outfit, same lighting, same environment. Only the pose changes: [description de la pose en 1-2 phrases]. Ultra-realistic, identical setting preserved.

EXEMPLE CONCRET pour Prompt 2 ou 3:
"Preserve the identity of the person from the input image. Same scene, same outfit, same lighting, same environment. Only the pose changes: holding a wine glass up to her lips with her left hand, head slightly tilted, relaxed expression. Ultra-realistic, identical setting preserved."

IMPORTANT:
- Chaque prompt DOIT commencer par "Prompt N:" sur sa propre ligne
- Les prompts 2+ font MAXIMUM 3 lignes
- Ne décris PAS le décor, la tenue ou l'éclairage dans les prompts 2+
- Décris UNIQUEMENT la nouvelle pose

Produis maintenant les ${imageBuffers.length} prompts.`

    // Construire les parts : texte système + toutes les images
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: carouselSystemPrompt }
    ]

    // Ajouter toutes les images
    for (let i = 0; i < imageBuffers.length; i++) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffers[i].toString('base64')
        }
      })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{
        parts
      }],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    })

    const responseText = (response.text || '').trim()

    // Parser la réponse pour extraire les prompts individuels
    const prompts = parseCarouselPrompts(responseText, imageBuffers.length)

    return prompts

  } catch (error) {
    // Gérer les erreurs spécifiques
    if (error instanceof GoogleAIError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      throw new GoogleAIError(
        'Trop de requêtes, réessayez dans quelques secondes',
        'RATE_LIMIT'
      )
    }

    // Contenu bloqué
    if (errorMessage.includes('blocked') || errorMessage.includes('safety') || errorMessage.includes('HARM')) {
      throw new GoogleAIError(
        'Les images ont été bloquées par les filtres de sécurité',
        'CONTENT_BLOCKED'
      )
    }

    // Erreur de connexion
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      throw new GoogleAIError(
        'Erreur de connexion à Google AI',
        'CONNECTION_ERROR'
      )
    }

    // Erreur générique
    throw new GoogleAIError(
      `Erreur Google AI: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}

/**
 * Options de configuration pour la génération d'image
 */
export interface ImageGenerationConfig {
  aspectRatio?: '9:16' | '1:1' | '16:9' // Format de l'image
  imageSize?: '1K' | '2K' | '4K'        // Qualité de l'image
}

/**
 * Génère une image via Gemini 3 Pro Image
 * @param referenceImageBase64 - Image de référence en base64 (le modèle)
 * @param prompt - Le prompt de génération (doit commencer par "Preserve the identity...")
 * @param config - Configuration optionnelle (format, qualité)
 * @returns Buffer de l'image générée
 */
export async function generateImageWithGemini(
  referenceImageBase64: string,
  prompt: string,
  config: ImageGenerationConfig = {}
): Promise<Buffer> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new GoogleAIError(
      'Configurez votre clé Google AI dans Settings',
      'NOT_CONFIGURED'
    )
  }

  // Configuration par défaut
  const aspectRatio = config.aspectRatio || '9:16'
  const imageSize = config.imageSize || '2K'

  try {
    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: referenceImageBase64,
              }
            },
            {
              text: prompt // Le prompt commence déjà par "Preserve the identity..."
            }
          ]
        }
      ],
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize
        }
      }
    })

    // Extraire l'image générée de la réponse
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part: { inlineData?: { data?: string } }) => part.inlineData?.data
    )

    if (!imagePart?.inlineData?.data) {
      // Vérifier si la réponse contient un message de blocage
      const textPart = response.candidates?.[0]?.content?.parts?.find(
        (part: { text?: string }) => part.text
      )
      if (textPart?.text) {
        throw new GoogleAIError(
          `L'API a refusé de générer l'image: ${textPart.text.substring(0, 100)}`,
          'CONTENT_BLOCKED'
        )
      }
      throw new GoogleAIError(
        'Aucune image générée dans la réponse',
        'GENERATION_FAILED'
      )
    }

    return Buffer.from(imagePart.inlineData.data, 'base64')
  } catch (error) {
    // Gérer les erreurs spécifiques
    if (error instanceof GoogleAIError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Rate limit
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      throw new GoogleAIError(
        'Trop de requêtes, réessayez dans quelques secondes',
        'RATE_LIMIT'
      )
    }

    // Contenu bloqué
    if (errorMessage.includes('blocked') || errorMessage.includes('safety') || errorMessage.includes('HARM')) {
      throw new GoogleAIError(
        'L\'image a été bloquée par les filtres de sécurité',
        'CONTENT_BLOCKED'
      )
    }

    // Timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new GoogleAIError(
        'La génération prend trop de temps, réessayez',
        'TIMEOUT'
      )
    }

    // Erreur de connexion
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      throw new GoogleAIError(
        'Erreur de connexion à Google AI',
        'CONNECTION_ERROR'
      )
    }

    // Erreur générique
    throw new GoogleAIError(
      `Erreur lors de la génération: ${errorMessage}`,
      'UNKNOWN'
    )
  }
}

/**
 * Génère une image via Gemini avec retry automatique pour les erreurs 503/surcharge
 * @param referenceImageBase64 - Image de référence en base64 (le modèle)
 * @param prompt - Le prompt de génération
 * @param config - Configuration optionnelle (format, qualité)
 * @param maxRetries - Nombre maximum de tentatives (défaut: 3)
 * @param delayMs - Délai entre les tentatives en ms (défaut: 5000)
 * @returns Buffer de l'image générée
 */
export async function generateImageWithGeminiWithRetry(
  referenceImageBase64: string,
  prompt: string,
  config: ImageGenerationConfig = {},
  maxRetries: number = 3,
  delayMs: number = 5000
): Promise<Buffer> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini generation attempt ${attempt}/${maxRetries}`)
      return await generateImageWithGemini(referenceImageBase64, prompt, config)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message

      // Vérifier si c'est une erreur de surcharge (503, overloaded, etc.)
      const isOverloaded =
        errorMessage.includes('503') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('capacity') ||
        errorMessage.includes('Service Unavailable')

      if (isOverloaded && attempt < maxRetries) {
        console.log(`Gemini model overloaded, retrying in ${delayMs / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      // Si ce n'est pas une erreur de surcharge ou c'est la dernière tentative
      throw error
    }
  }

  throw lastError || new Error('Generation failed after retries')
}
