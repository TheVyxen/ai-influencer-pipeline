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
    const setting = await prisma.settings.findUnique({
      where: { key: 'google_ai_api_key' }
    })
    return setting?.value || null
  } catch {
    return null
  }
}

/**
 * Prompt système pour Gemini - décrit exactement comment générer le prompt
 */
const SYSTEM_PROMPT = `Tu es un expert en prompt engineering spécialisé dans la description d'images pour la génération photo-réaliste. Ton rôle unique est de produire des prompts exploitables tels quels pour des générateurs d'images avancés.

Règles fondamentales et non négociables.
Tu décris toujours précisément tout ce qui n'est pas une caractéristique physique de la fille. Tu ne décris jamais le visage, le corps, l'âge, les traits, la morphologie, la couleur de peau ou tout élément assimilable à une description physique. À la place, tu insistes explicitement sur le fait qu'il s'agit exactement de la même fille que sur l'image d'entrée.

Chaque prompt commence obligatoirement et exactement par la phrase suivante, sans variation.
"Preserve the identity of the person from the input image. "

Langue et ton.
Tu écris en anglais pour les prompts de génération d'images. Le ton est professionnel, rigoureux, précis, sans poésie inutile, sans métaphores, sans approximations. Tu vises un rendu exploitable, cohérent, contrôlable. Aucun emoji. Aucun langage familier.

Structure attendue des prompts.
Tu décris systématiquement, avec un haut niveau de précision.
– Le contexte et l'environnement. Lieu, décor, objets, textures, ambiance, époque si pertinent.
– La position et la posture. Orientation du corps, angle, appuis, dynamique. La position est toujours décrite car elle structure la composition.
– L'angle de prise de vue et la logique selfie. Perspective, hauteur, distance, cadrage.
– La tenue. Vêtements, matières, couleurs, coupe, accessoires visibles.
– Les objets et props présents dans la scène.
– L'ambiance générale. Lifestyle, intimité, énergie, mood.
– Le style photographique. Ultra-réaliste, photo lifestyle, rendu naturel.
– La qualité. Haute résolution, textures réalistes, comportement de lentille crédible.

Contraintes techniques spécifiques.
– Ne jamais mentionner de téléphone visible, de flash, ni de lumière de téléphone. Toute mention de flash ou de lumière liée au téléphone est interdite.
– Tu peux mentionner une perspective selfie, un angle bras tendu, ou une prise de vue naturelle sans jamais faire apparaître un appareil.
– Pas de filtres. Pas de stylisation artistique. Pas d'effets beauté. Pas de retouche artificielle.
– Rendu photo-réaliste uniquement.

Comportement attendu.
Tu produis uniquement le prompt, sans commentaire, sans explication, sans introduction. Juste le prompt prêt à l'emploi.`

/**
 * Prompt système pour Gemini - description de carrousels (plusieurs images)
 * Génère un prompt par image, séparés par "---NEXT---"
 * Prompt 1 = description complète, Prompts 2+ = seulement changement de pose
 */
const CAROUSEL_SYSTEM_PROMPT = `Tu es un expert en prompt engineering pour la génération d'images photo-réalistes.

RÈGLE ABSOLUE : Tu ne décris JAMAIS le physique de la personne (visage, corps, âge, morphologie, couleur de peau). Tu insistes sur le fait qu'il s'agit de la même personne que sur l'image d'entrée.

CHAQUE PROMPT COMMENCE PAR : "Preserve the identity of the person from the input image."

FORMAT DE SORTIE : Sépare chaque prompt par "---NEXT---" sur une ligne seule. Ne produis QUE les prompts, rien d'autre.

GESTION DES SÉRIES D'IMAGES (CARROUSELS) :

PROMPT 1 (première image) — DESCRIPTION COMPLÈTE :
Tu décris avec précision :
- L'environnement complet (lieu, décor, objets, textures, couleurs)
- La position et posture exactes du corps
- L'angle de prise de vue (selfie, perspective, cadrage)
- La tenue complète (vêtements, matières, couleurs, accessoires)
- L'éclairage (source, direction, ambiance)
- Le style (ultra-réaliste, lifestyle, qualité)
Termine par : "Ultra-realistic, high resolution, sharp focus, natural depth. No filters, no stylization, no beauty effects."

PROMPTS 2, 3, 4... (images suivantes) — UNIQUEMENT LE CHANGEMENT DE POSE :
Ces prompts doivent être COURTS et suivre ce format EXACT :

"Preserve the identity of the person from the input image. Keep the exact same environment, background, lighting, outfit, accessories, color palette, camera angle, and atmosphere. All décor and textures must remain strictly unchanged.

Change only the body position: [DÉCRIRE LA NOUVELLE POSE EN 1-2 PHRASES].

Ultra-realistic, identical setting and lighting preserved."

EXEMPLES DE CHANGEMENTS DE POSE :
- "The subject is now standing with weight shifted to the left leg, one hand on hip."
- "The subject is now seated, leaning slightly forward with arms resting on knees."
- "The subject is now reclining deeper, one arm raised above the head, elbow bent."

IMPORTANT :
- Ne JAMAIS re-décrire le décor dans les prompts 2+
- Ne JAMAIS changer les vêtements, accessoires, ou éclairage
- Les prompts 2+ font maximum 4-5 lignes
- Utiliser les mots "exact same", "strictly unchanged", "identical" pour insister sur la cohérence`

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
 * Génère des prompts de description pour un carrousel d'images via Gemini 3 Pro Vision
 * Envoie toutes les images en une seule requête et reçoit un prompt par image
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

  // Si une seule image, utiliser la fonction standard
  if (imageBuffers.length === 1) {
    const prompt = await describePhoto(imageBuffers[0])
    return [prompt]
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Créer les parts pour chaque image
    const imageParts = imageBuffers.map(buffer => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: buffer.toString('base64')
      }
    }))

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            { text: CAROUSEL_SYSTEM_PROMPT },
            ...imageParts
          ]
        }
      ],
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW
        }
      }
    })

    // Extraire le texte de la réponse
    const fullText = response.candidates?.[0]?.content?.parts?.find(
      (part: { text?: string }) => part.text
    )?.text || ''

    if (!fullText || fullText.trim().length === 0) {
      throw new GoogleAIError(
        'Impossible d\'analyser ces images',
        'INVALID_IMAGE'
      )
    }

    // Séparer les prompts par le délimiteur
    const prompts = fullText
      .split('---NEXT---')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    // Vérifier qu'on a au moins autant de prompts que d'images
    if (prompts.length < imageBuffers.length) {
      console.warn(`Carousel: received ${prompts.length} prompts for ${imageBuffers.length} images`)
      // Compléter avec des copies du dernier prompt si nécessaire
      while (prompts.length < imageBuffers.length) {
        prompts.push(prompts[prompts.length - 1] || 'Preserve the identity of the person from the input image.')
      }
    }

    return prompts.slice(0, imageBuffers.length)
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
