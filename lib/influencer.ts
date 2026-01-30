import prisma from '@/lib/prisma'
import { Influencer, InfluencerSettings, Prisma } from '@prisma/client'

// Types pour les opérations CRUD
export type InfluencerWithSettings = Influencer & {
  settings: InfluencerSettings | null
}

export type CreateInfluencerInput = {
  name: string
  handle: string
  avatarData?: string
  referencePhotoData?: string
}

export type UpdateInfluencerInput = Partial<CreateInfluencerInput> & {
  isActive?: boolean
  agentEnabled?: boolean
  agentInterval?: number
}

export type UpdateInfluencerSettingsInput = Partial<{
  imageProvider: string
  imageAspectRatio: string
  imageSize: string
  postsPerScrape: number
  autoScrapeEnabled: boolean
  autoScrapeInterval: number
  captionTone: string
  captionLength: string
  captionEmojis: boolean
  hashtagCount: number
  validationThreshold: number
  postsPerDay: number
  timeSlots: string
}>

// Type pour influenceuse avec dernier pipeline run
export type InfluencerWithLastRun = Influencer & {
  lastPipelineRun?: {
    id: string
    status: string
    createdAt: Date
  } | null
}

/**
 * Récupère la liste de toutes les influenceuses avec leur dernier pipeline run
 */
export async function getInfluencers(): Promise<InfluencerWithLastRun[]> {
  const influencers = await prisma.influencer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      pipelineRuns: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true
        }
      }
    }
  })

  // Transformer la structure pour avoir lastPipelineRun au lieu de pipelineRuns[]
  return influencers.map(inf => ({
    ...inf,
    lastPipelineRun: inf.pipelineRuns[0] || null,
    pipelineRuns: undefined as never
  }))
}

/**
 * Récupère une influenceuse par son ID avec ses settings
 */
export async function getInfluencerById(id: string): Promise<InfluencerWithSettings | null> {
  return prisma.influencer.findUnique({
    where: { id },
    include: { settings: true }
  })
}

/**
 * Récupère une influenceuse par son handle
 */
export async function getInfluencerByHandle(handle: string): Promise<Influencer | null> {
  return prisma.influencer.findUnique({
    where: { handle }
  })
}

/**
 * Crée une nouvelle influenceuse avec ses settings par défaut
 */
export async function createInfluencer(input: CreateInfluencerInput): Promise<InfluencerWithSettings> {
  // Normaliser le handle (ajouter @ si absent)
  const handle = input.handle.startsWith('@') ? input.handle : `@${input.handle}`

  return prisma.influencer.create({
    data: {
      name: input.name,
      handle,
      avatarData: input.avatarData,
      referencePhotoData: input.referencePhotoData,
      // Créer les settings par défaut
      settings: {
        create: {}
      }
    },
    include: { settings: true }
  })
}

/**
 * Met à jour une influenceuse
 */
export async function updateInfluencer(
  id: string,
  input: UpdateInfluencerInput
): Promise<Influencer> {
  const data: Prisma.InfluencerUpdateInput = {}

  if (input.name !== undefined) data.name = input.name
  if (input.handle !== undefined) {
    data.handle = input.handle.startsWith('@') ? input.handle : `@${input.handle}`
  }
  if (input.avatarData !== undefined) data.avatarData = input.avatarData
  if (input.referencePhotoData !== undefined) data.referencePhotoData = input.referencePhotoData
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.agentEnabled !== undefined) data.agentEnabled = input.agentEnabled
  if (input.agentInterval !== undefined) data.agentInterval = input.agentInterval

  return prisma.influencer.update({
    where: { id },
    data
  })
}

/**
 * Supprime une influenceuse et toutes ses données associées (cascade)
 */
export async function deleteInfluencer(id: string): Promise<void> {
  await prisma.influencer.delete({
    where: { id }
  })
}

/**
 * Met à jour les settings d'une influenceuse
 */
export async function updateInfluencerSettings(
  influencerId: string,
  input: UpdateInfluencerSettingsInput
): Promise<InfluencerSettings> {
  // Upsert pour créer les settings s'ils n'existent pas
  return prisma.influencerSettings.upsert({
    where: { influencerId },
    create: {
      influencerId,
      ...input
    },
    update: input
  })
}

/**
 * Récupère les settings d'une influenceuse
 */
export async function getInfluencerSettings(
  influencerId: string
): Promise<InfluencerSettings | null> {
  return prisma.influencerSettings.findUnique({
    where: { influencerId }
  })
}

/**
 * Met à jour la photo de référence d'une influenceuse
 */
export async function updateReferencePhoto(
  influencerId: string,
  base64Data: string | null
): Promise<Influencer> {
  return prisma.influencer.update({
    where: { id: influencerId },
    data: { referencePhotoData: base64Data }
  })
}

/**
 * Met à jour l'avatar d'une influenceuse
 */
export async function updateAvatar(
  influencerId: string,
  base64Data: string | null
): Promise<Influencer> {
  return prisma.influencer.update({
    where: { id: influencerId },
    data: { avatarData: base64Data }
  })
}

/**
 * Récupère les statistiques d'une influenceuse
 */
export async function getInfluencerStats(influencerId: string) {
  const [sourcesCount, pendingCount, approvedCount, generatedCount] = await Promise.all([
    prisma.source.count({ where: { influencerId } }),
    prisma.sourcePhoto.count({
      where: {
        source: { influencerId },
        status: 'pending'
      }
    }),
    prisma.sourcePhoto.count({
      where: {
        source: { influencerId },
        status: 'approved'
      }
    }),
    prisma.generatedPhoto.count({
      where: {
        sourcePhoto: {
          source: { influencerId }
        }
      }
    })
  ])

  return {
    sources: sourcesCount,
    pending: pendingCount,
    approved: approvedCount,
    generated: generatedCount
  }
}

/**
 * Récupère ou crée l'influenceuse par défaut (pour migration)
 */
export async function getOrCreateDefaultInfluencer(): Promise<Influencer> {
  const DEFAULT_HANDLE = '@default'

  let influencer = await prisma.influencer.findUnique({
    where: { handle: DEFAULT_HANDLE }
  })

  if (!influencer) {
    influencer = await prisma.influencer.create({
      data: {
        name: 'Default',
        handle: DEFAULT_HANDLE,
        settings: { create: {} }
      }
    })
  }

  return influencer
}
