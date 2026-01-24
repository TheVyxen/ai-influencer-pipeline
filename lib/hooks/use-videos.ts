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
 * Interface pour les images sources uploadées
 */
export interface VideoSource {
  id: string
  originalName: string
  mimeType: string
  createdAt: string
  // imageData n'est pas inclus pour éviter de charger les images en base64
}

/**
 * Interface pour les vidéos générées
 */
export interface GeneratedVideo {
  id: string
  sourceId: string
  prompt: string | null
  aspectRatio: string
  duration: number
  resolution: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  operationId: string | null
  gcsUri: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  source: {
    id: string
    originalName: string
  }
}

/**
 * Clés SWR pour le cache des vidéos
 */
export const VIDEO_SWR_KEYS = {
  videoSources: '/api/videos/sources',
  generatedVideos: '/api/videos',
  videoStatus: (id: string) => `/api/videos/${id}/status`,
}

/**
 * Hook pour récupérer les images sources uploadées
 */
export function useVideoSources() {
  const { data, error, isLoading, mutate: mutateSources } = useSWR<VideoSource[]>(
    VIDEO_SWR_KEYS.videoSources,
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
 * Hook pour récupérer les vidéos générées
 */
export function useGeneratedVideos() {
  const { data, error, isLoading, mutate: mutateVideos } = useSWR<GeneratedVideo[]>(
    VIDEO_SWR_KEYS.generatedVideos,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
    }
  )

  return {
    videos: data || [],
    isLoading,
    isError: error,
    mutate: mutateVideos,
  }
}

/**
 * Hook pour surveiller le statut d'une génération en cours
 * Polling automatique toutes les 10 secondes tant que la vidéo est en processing
 * @param videoId - ID de la vidéo à surveiller
 * @param enabled - Activer le polling (désactiver si la vidéo est déjà terminée)
 */
export function useVideoStatus(videoId: string | null, enabled: boolean = true) {
  const { data, error, isLoading } = useSWR<GeneratedVideo>(
    videoId && enabled ? VIDEO_SWR_KEYS.videoStatus(videoId) : null,
    fetcher,
    {
      // Polling toutes les 10 secondes pendant le processing
      refreshInterval: 10000,
      revalidateOnFocus: false,
    }
  )

  return {
    video: data,
    isLoading,
    isError: error,
  }
}

/**
 * Rafraîchit toutes les données vidéo
 */
export async function refreshAllVideoData() {
  await Promise.all([
    mutate(VIDEO_SWR_KEYS.videoSources),
    mutate(VIDEO_SWR_KEYS.generatedVideos),
  ])
}

/**
 * Rafraîchit uniquement les sources
 */
export async function refreshVideoSources() {
  await mutate(VIDEO_SWR_KEYS.videoSources)
}

/**
 * Rafraîchit uniquement les vidéos générées
 */
export async function refreshGeneratedVideos() {
  await mutate(VIDEO_SWR_KEYS.generatedVideos)
}

/**
 * Rafraîchit le statut d'une vidéo spécifique
 * @param videoId - ID de la vidéo
 */
export async function refreshVideoStatus(videoId: string) {
  await mutate(VIDEO_SWR_KEYS.videoStatus(videoId))
}
