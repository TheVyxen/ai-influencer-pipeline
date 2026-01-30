'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, User, Plus, Settings } from 'lucide-react'
import { useInfluencerContext, Influencer } from '@/lib/hooks/use-influencer-context'

/**
 * Sélecteur d'influenceuse dans le header
 * Permet de changer rapidement d'influenceuse active
 */
export function InfluencerSelector() {
  const router = useRouter()
  const { selectedInfluencer, influencers, isLoading, selectInfluencer } = useInfluencerContext()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fermer avec Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleSelect = (influencer: Influencer) => {
    selectInfluencer(influencer.id)
    setIsOpen(false)
  }

  const handleManage = () => {
    setIsOpen(false)
    router.push('/influencers')
  }

  if (isLoading) {
    return (
      <div className="h-9 w-36 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    )
  }

  // Si aucune influenceuse, afficher un bouton pour en créer
  if (influencers.length === 0) {
    return (
      <button
        onClick={() => router.push('/influencers')}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Créer une influenceuse
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton de sélection */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors min-w-[140px]"
      >
        {/* Avatar */}
        {selectedInfluencer?.avatarData ? (
          <img
            src={selectedInfluencer.avatarData}
            alt={selectedInfluencer.name}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Nom */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[100px]">
          {selectedInfluencer?.name || 'Sélectionner'}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          {/* Liste des influenceuses */}
          <div className="max-h-64 overflow-y-auto">
            {influencers.map(influencer => (
              <button
                key={influencer.id}
                onClick={() => handleSelect(influencer)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  selectedInfluencer?.id === influencer.id
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : ''
                }`}
              >
                {/* Avatar */}
                {influencer.avatarData ? (
                  <img
                    src={influencer.avatarData}
                    alt={influencer.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    selectedInfluencer?.id === influencer.id
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}>
                    {influencer.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {influencer.handle}
                  </p>
                </div>

                {/* Indicateur de sélection */}
                {selectedInfluencer?.id === influencer.id && (
                  <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          {/* Actions */}
          <button
            onClick={handleManage}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Gérer les influenceuses
          </button>
        </div>
      )}
    </div>
  )
}
