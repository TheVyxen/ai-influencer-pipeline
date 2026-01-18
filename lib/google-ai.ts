/**
 * Service Google AI / Gemini pour la description de photos
 * Utilise Gemini 2.0 Flash pour analyser les images et générer des prompts
 * IMPORTANT: Ne jamais décrire le physique de la personne
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

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
 * Vérifie si la clé API Google AI est configurée
 */
export function isGoogleAIConfigured(): boolean {
  return Boolean(GOOGLE_AI_API_KEY && GOOGLE_AI_API_KEY.length > 0)
}

/**
 * Types d'erreurs possibles
 */
export class GoogleAIError extends Error {
  constructor(
    message: string,
    public code: 'NOT_CONFIGURED' | 'RATE_LIMIT' | 'INVALID_IMAGE' | 'CONNECTION_ERROR' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'GoogleAIError'
  }
}

/**
 * Génère un prompt de description d'image via Gemini Vision
 * @param imageBuffer - Buffer de l'image à analyser
 * @param mimeType - Type MIME de l'image (ex: 'image/jpeg')
 * @returns Le prompt complet généré par Gemini
 */
export async function describePhoto(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  if (!isGoogleAIConfigured()) {
    throw new GoogleAIError(
      'Google AI API key is not configured',
      'NOT_CONFIGURED'
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY!)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: SYSTEM_PROMPT,
    })

    // Convertir le buffer en base64 pour l'API
    const base64Image = imageBuffer.toString('base64')

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      'Analyse cette image et génère le prompt.',
    ])

    const response = result.response
    const text = response.text()

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
