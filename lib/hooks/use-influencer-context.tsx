'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'

// Type pour une influenceuse
export interface Influencer {
  id: string
  name: string
  handle: string
  isActive: boolean
  avatarData: string | null
  referencePhotoData: string | null
  agentEnabled: boolean
  agentInterval: number
  lastAgentRun: string | null
  createdAt: string
  updatedAt: string
}

// Clé localStorage pour persister la sélection
const STORAGE_KEY = 'selectedInfluencerId'

// Fetcher pour SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// Interface du contexte
interface InfluencerContextType {
  // Influenceuse sélectionnée
  selectedInfluencer: Influencer | null
  selectedInfluencerId: string | null

  // Liste des influenceuses
  influencers: Influencer[]
  isLoading: boolean
  isError: boolean

  // Actions
  selectInfluencer: (id: string | null) => void
  refreshInfluencers: () => Promise<void>
}

// Contexte avec valeurs par défaut
const InfluencerContext = createContext<InfluencerContextType>({
  selectedInfluencer: null,
  selectedInfluencerId: null,
  influencers: [],
  isLoading: true,
  isError: false,
  selectInfluencer: () => {},
  refreshInfluencers: async () => {}
})

// Hook pour utiliser le contexte
export function useInfluencerContext() {
  const context = useContext(InfluencerContext)
  if (!context) {
    throw new Error('useInfluencerContext must be used within InfluencerProvider')
  }
  return context
}

// Alias pour compatibilité
export const useInfluencer = useInfluencerContext

// Hook simplifié pour obtenir l'ID sélectionné
export function useSelectedInfluencerId(): string | null {
  const { selectedInfluencerId } = useInfluencerContext()
  return selectedInfluencerId
}

// Provider du contexte
export function InfluencerProvider({ children }: { children: React.ReactNode }) {
  // ID de l'influenceuse sélectionnée (persisté dans localStorage)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Récupérer la liste des influenceuses
  const { data: influencers, error, isLoading, mutate } = useSWR<Influencer[]>(
    '/api/influencers',
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false
    }
  )

  // Charger l'ID depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSelectedId(stored)
      }
      setIsInitialized(true)
    }
  }, [])

  // Valider que l'ID sélectionné existe toujours
  useEffect(() => {
    if (isInitialized && influencers && influencers.length > 0) {
      const exists = influencers.some(i => i.id === selectedId)

      if (!exists) {
        // Si l'ID n'existe plus, sélectionner la première influenceuse
        const firstId = influencers[0].id
        setSelectedId(firstId)
        localStorage.setItem(STORAGE_KEY, firstId)
      }
    }
  }, [influencers, selectedId, isInitialized])

  // Sélectionner automatiquement si aucune sélection et des influenceuses existent
  useEffect(() => {
    if (isInitialized && !selectedId && influencers && influencers.length > 0) {
      const firstId = influencers[0].id
      setSelectedId(firstId)
      localStorage.setItem(STORAGE_KEY, firstId)
    }
  }, [influencers, selectedId, isInitialized])

  // Fonction pour changer la sélection
  const selectInfluencer = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Fonction pour rafraîchir la liste
  const refreshInfluencers = useCallback(async () => {
    await mutate()
  }, [mutate])

  // Trouver l'influenceuse sélectionnée dans la liste
  const selectedInfluencer = influencers?.find(i => i.id === selectedId) || null

  const value: InfluencerContextType = {
    selectedInfluencer,
    selectedInfluencerId: selectedId,
    influencers: influencers || [],
    isLoading: isLoading || !isInitialized,
    isError: !!error,
    selectInfluencer,
    refreshInfluencers
  }

  return (
    <InfluencerContext.Provider value={value}>
      {children}
    </InfluencerContext.Provider>
  )
}
