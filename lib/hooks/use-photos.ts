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
 * Clés SWR pour le cache
 */
export const SWR_KEYS = {
  pendingPhotos: '/api/photos/pending',
  generatedPhotos: '/api/photos/generated',
  stats: '/api/stats',
}

/**
 * Hook pour récupérer les photos en attente
 */
export function usePendingPhotos() {
  const { data, error, isLoading, mutate: mutatePending } = useSWR<PendingPhoto[]>(
    SWR_KEYS.pendingPhotos,
    fetcher,
    {
      // Désactiver le polling automatique (économie de bande passante)
      refreshInterval: 0,
      // Revalider quand la fenêtre reprend le focus
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
 * Hook pour récupérer les photos générées
 */
export function useGeneratedPhotos() {
  const { data, error, isLoading, mutate: mutateGenerated } = useSWR<GeneratedPhoto[]>(
    SWR_KEYS.generatedPhotos,
    fetcher,
    {
      // Désactiver le polling automatique (économie de bande passante)
      refreshInterval: 0,
      // Revalider quand la fenêtre reprend le focus
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
 * Hook pour récupérer les statistiques
 */
export function useStats() {
  const { data, error, isLoading, mutate: mutateStats } = useSWR<Stats>(
    SWR_KEYS.stats,
    fetcher,
    {
      // Désactiver le polling automatique (économie de bande passante)
      refreshInterval: 0,
      // Revalider quand la fenêtre reprend le focus
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
 * Rafraîchit toutes les données (photos et stats)
 * À appeler après une mutation (approve, generate, scrape, delete)
 */
export async function refreshAllData() {
  await Promise.all([
    mutate(SWR_KEYS.pendingPhotos),
    mutate(SWR_KEYS.generatedPhotos),
    mutate(SWR_KEYS.stats),
  ])
}

/**
 * Rafraîchit uniquement les photos en attente
 */
export async function refreshPendingPhotos() {
  await mutate(SWR_KEYS.pendingPhotos)
  await mutate(SWR_KEYS.stats)
}

/**
 * Rafraîchit uniquement les photos générées
 */
export async function refreshGeneratedPhotos() {
  await mutate(SWR_KEYS.generatedPhotos)
  await mutate(SWR_KEYS.stats)
}
