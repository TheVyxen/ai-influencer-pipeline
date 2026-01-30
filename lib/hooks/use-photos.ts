'use client'

import useSWR, { mutate } from 'swr'

/**
 * Fetcher générique pour SWR
 */
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

/**
 * Construit une URL avec le paramètre influencerId
 */
function buildUrl(baseUrl: string, influencerId: string | null): string | null {
  if (!influencerId) return null // Ne pas fetch si pas d'influenceur sélectionné
  return `${baseUrl}?influencerId=${influencerId}`
}

/**
 * Interface pour les photos en attente de validation
 */
export interface PendingPhoto {
  id: string
  originalUrl: string
  localPath: string | null
  status: string
  createdAt: string
  instagramPostUrl: string | null
  instagramPublishedAt: string | null
  isCarousel: boolean
  carouselId: string | null
  carouselIndex: number | null
  carouselTotal: number | null
  source: {
    username: string
  }
}

/**
 * Interface pour les photos générées
 */
export interface GeneratedPhoto {
  id: string
  prompt: string
  localPath: string | null
  createdAt: string
  isCarousel?: boolean
  carouselId?: string | null
  carouselIndex?: number | null
  carouselTotal?: number | null
  sourcePhoto: {
    id: string
    source: {
      username: string
    }
  }
}

/**
 * Interface pour les statistiques
 */
export interface Stats {
  sourcesCount: number
  pendingCount: number
  generatedCount: number
  lastActivity: string | null
}

/**
 * URLs de base pour les APIs
 */
export const API_URLS = {
  pendingPhotos: '/api/photos/pending',
  approvedPhotos: '/api/photos/approved',
  generatedPhotos: '/api/photos/generated',
  sources: '/api/sources',
  stats: '/api/stats',
}

/**
 * Génère les clés SWR pour un influenceur donné
 */
export function getSWRKeys(influencerId: string | null) {
  return {
    pendingPhotos: buildUrl(API_URLS.pendingPhotos, influencerId),
    approvedPhotos: buildUrl(API_URLS.approvedPhotos, influencerId),
    generatedPhotos: buildUrl(API_URLS.generatedPhotos, influencerId),
    sources: buildUrl(API_URLS.sources, influencerId),
    stats: buildUrl(API_URLS.stats, influencerId),
  }
}

/**
 * Hook pour récupérer les photos en attente
 * @param influencerId - ID de l'influenceur (requis)
 */
export function usePendingPhotos(influencerId: string | null) {
  const url = buildUrl(API_URLS.pendingPhotos, influencerId)

  const { data, error, isLoading, mutate: mutatePending } = useSWR<PendingPhoto[]>(
    url,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    photos: data || [],
    isLoading,
    isError: error,
    mutate: mutatePending,
  }
}

/**
 * Hook pour récupérer les photos approuvées
 * @param influencerId - ID de l'influenceur (requis)
 */
export function useApprovedPhotos(influencerId: string | null) {
  const url = buildUrl(API_URLS.approvedPhotos, influencerId)

  const { data, error, isLoading, mutate: mutateApproved } = useSWR<PendingPhoto[]>(
    url,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    photos: data || [],
    isLoading,
    isError: error,
    mutate: mutateApproved,
  }
}

/**
 * Hook pour récupérer les photos générées
 * @param influencerId - ID de l'influenceur (requis)
 */
export function useGeneratedPhotos(influencerId: string | null) {
  const url = buildUrl(API_URLS.generatedPhotos, influencerId)

  const { data, error, isLoading, mutate: mutateGenerated } = useSWR<GeneratedPhoto[]>(
    url,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    photos: data || [],
    isLoading,
    isError: error,
    mutate: mutateGenerated,
  }
}

/**
 * Hook pour récupérer les sources
 * @param influencerId - ID de l'influenceur (requis)
 */
export interface Source {
  id: string
  username: string
  isActive: boolean
  influencerId: string | null
  createdAt: string
  _count: {
    photos: number
  }
}

export function useSources(influencerId: string | null) {
  const url = buildUrl(API_URLS.sources, influencerId)

  const { data, error, isLoading, mutate: mutateSources } = useSWR<Source[]>(
    url,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    sources: data || [],
    isLoading,
    isError: error,
    mutate: mutateSources,
  }
}

/**
 * Hook pour récupérer les statistiques
 * @param influencerId - ID de l'influenceur (requis)
 */
export function useStats(influencerId: string | null) {
  const url = buildUrl(API_URLS.stats, influencerId)

  const { data, error, isLoading, mutate: mutateStats } = useSWR<Stats>(
    url,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate: mutateStats,
  }
}

/**
 * Rafraîchit toutes les données (photos et stats) pour un influenceur
 * À appeler après une mutation (approve, generate, scrape, delete)
 * @param influencerId - ID de l'influenceur
 */
export async function refreshAllData(influencerId: string | null) {
  if (!influencerId) return
  const keys = getSWRKeys(influencerId)
  await Promise.all([
    mutate(keys.pendingPhotos),
    mutate(keys.approvedPhotos),
    mutate(keys.generatedPhotos),
    mutate(keys.sources),
    mutate(keys.stats),
  ])
}

/**
 * Rafraîchit uniquement les photos en attente
 * @param influencerId - ID de l'influenceur
 */
export async function refreshPendingPhotos(influencerId: string | null) {
  if (!influencerId) return
  const keys = getSWRKeys(influencerId)
  await mutate(keys.pendingPhotos)
  await mutate(keys.stats)
}

/**
 * Rafraîchit uniquement les photos approuvées
 * @param influencerId - ID de l'influenceur
 */
export async function refreshApprovedPhotos(influencerId: string | null) {
  if (!influencerId) return
  const keys = getSWRKeys(influencerId)
  await mutate(keys.approvedPhotos)
  await mutate(keys.stats)
}

/**
 * Rafraîchit uniquement les photos générées
 * @param influencerId - ID de l'influenceur
 */
export async function refreshGeneratedPhotos(influencerId: string | null) {
  if (!influencerId) return
  const keys = getSWRKeys(influencerId)
  await mutate(keys.generatedPhotos)
  await mutate(keys.stats)
}

/**
 * Rafraîchit uniquement les sources
 * @param influencerId - ID de l'influenceur
 */
export async function refreshSources(influencerId: string | null) {
  if (!influencerId) return
  const keys = getSWRKeys(influencerId)
  await mutate(keys.sources)
  await mutate(keys.stats)
}
