'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, User, Settings, Trash2, ChevronRight, Users, Play, Loader2, Bot } from 'lucide-react'
import { PipelineStatusBadge } from '@/components/PipelineStatusBadge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

// Type pour une influenceuse
interface Influencer {
  id: string
  name: string
  handle: string
  isActive: boolean
  avatarData: string | null
  referencePhotoData: string | null
  agentEnabled: boolean
  createdAt: string
  lastPipelineRun?: {
    id: string
    status: string
    createdAt: string
  } | null
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

/**
 * Page de gestion des influenceuses
 * Liste toutes les influenceuses avec possibilité de créer, éditer, supprimer
 */
export default function InfluencersPage() {
  const router = useRouter()
  const { data: influencers, error, isLoading, mutate } = useSWR<Influencer[]>(
    '/api/influencers',
    fetcher
  )

  // États pour la création
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHandle, setNewHandle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // État pour la suppression
  const [deleteTarget, setDeleteTarget] = useState<Influencer | null>(null)

  // État pour le déclenchement de pipeline
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  // Créer une nouvelle influenceuse
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newName.trim() || !newHandle.trim()) {
      toast.error('Nom et handle requis')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          handle: newHandle.trim()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }

      toast.success('Influenceuse créée')
      setNewName('')
      setNewHandle('')
      setIsCreating(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Déclencher un pipeline pour une influenceuse
  const handleTriggerPipeline = async (influencer: Influencer) => {
    if (!influencer.referencePhotoData) {
      toast.error('Photo de référence requise pour lancer le pipeline')
      return
    }

    setTriggeringId(influencer.id)
    try {
      const res = await fetch(`/api/agent/pipeline/${influencer.id}`, {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors du déclenchement')
      }

      toast.success(`Pipeline lancé pour ${influencer.name}`)
      mutate() // Recharger la liste pour voir le nouveau statut
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du déclenchement')
    } finally {
      setTriggeringId(null)
    }
  }

  // Supprimer une influenceuse
  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetch(`/api/influencers/${deleteTarget.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      toast.success('Influenceuse supprimée')
      setDeleteTarget(null)
      mutate()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </a>
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                Influenceuses
              </h1>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Formulaire de création */}
        {isCreating && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Nouvelle influenceuse
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Sofia AI"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">@</span>
                  <input
                    type="text"
                    value={newHandle.replace('@', '')}
                    onChange={e => setNewHandle(e.target.value.replace('@', ''))}
                    placeholder="sofia_ai"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsCreating(false)
                    setNewName('')
                    setNewHandle('')
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des influenceuses */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Erreur lors du chargement
          </div>
        ) : influencers && influencers.length > 0 ? (
          <div className="space-y-4">
            {influencers.map(influencer => (
              <div
                key={influencer.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    {influencer.avatarData ? (
                      <img
                        src={influencer.avatarData}
                        alt={influencer.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {/* Indicateur d'agent */}
                    {influencer.agentEnabled && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {influencer.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {influencer.handle}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {/* Statut du dernier pipeline */}
                    {influencer.lastPipelineRun && (
                      <PipelineStatusBadge
                        status={influencer.lastPipelineRun.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'}
                        size="sm"
                      />
                    )}
                    {!influencer.isActive && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        Inactive
                      </span>
                    )}
                    {!influencer.referencePhotoData && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded">
                        Photo manquante
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Bouton Run Pipeline */}
                    <button
                      onClick={() => handleTriggerPipeline(influencer)}
                      disabled={triggeringId === influencer.id || !influencer.referencePhotoData}
                      className={`p-2 rounded-lg transition-colors ${
                        !influencer.referencePhotoData
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                      title={!influencer.referencePhotoData ? 'Photo de référence requise' : 'Lancer le pipeline'}
                    >
                      {triggeringId === influencer.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => router.push(`/influencers/${influencer.id}`)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="Configurer"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(influencer)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => router.push(`/influencers/${influencer.id}`)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucune influenceuse
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Créez votre première influenceuse pour commencer
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une influenceuse
            </Button>
          </div>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer l'influenceuse"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteTarget?.name}" ? Toutes ses données (sources, photos, vidéos) seront également supprimées. Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
      />
    </main>
  )
}
