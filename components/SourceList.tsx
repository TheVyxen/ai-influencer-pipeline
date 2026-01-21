'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'
import { ConfirmModal } from './ui/ConfirmModal'
import { refreshAllData } from '@/lib/hooks/use-photos'

interface Source {
  id: string
  username: string
  isActive: boolean
  createdAt: string
  _count: {
    photos: number
  }
}

interface ScrapeResult {
  sourceId: string
  username: string
  photosFound: number
  photosImported: number
  photosSkipped: number
  error?: string
}

interface SourceListProps {
  initialSources: Source[]
}

/**
 * Colonne gauche : Liste des sources Instagram
 * Utilise SWR pour rafraîchir les données après scraping
 */
export function SourceList({ initialSources }: SourceListProps) {
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // États pour le scraping
  const [isScraping, setIsScraping] = useState(false)
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null)

  // État pour la modal de confirmation
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; source: Source | null }>({
    isOpen: false,
    source: null,
  })

  // Ajouter une nouvelle source
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || isLoading) return

    setIsLoading(true)

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add source')
      }

      const newSource = await res.json()
      setSources(prev => [{ ...newSource, _count: { photos: 0 } }, ...prev])
      setUsername('')
      toast.success(`@${newSource.username} ajouté avec succès`)
      // Rafraîchir les stats via SWR
      await refreshAllData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  // Supprimer une source
  const handleDelete = async () => {
    if (!deleteModal.source) return

    try {
      const res = await fetch(`/api/sources/${deleteModal.source.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete source')
      }

      setSources(prev => prev.filter(s => s.id !== deleteModal.source!.id))
      toast.success(`@${deleteModal.source.username} supprimé`)
      // Rafraîchir les données via SWR (les photos associées sont supprimées)
      await refreshAllData()
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error('Error deleting source:', err)
    } finally {
      setDeleteModal({ isOpen: false, source: null })
    }
  }

  // Scraper une source individuelle
  const handleScrapeOne = async (id: string, username: string) => {
    if (isScraping) return

    setScrapingSourceId(id)
    setIsScraping(true)
    const toastId = toast.loading(`Scraping @${username}...`)

    try {
      const res = await fetch(`/api/scrape/${id}`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du scraping')
      }

      const result = data.result as ScrapeResult
      if (result.photosImported > 0) {
        toast.success(`${result.photosImported} photo(s) importée(s) depuis @${username}`, { id: toastId })
        setSources(prev => prev.map(s =>
          s.id === id
            ? { ...s, _count: { photos: s._count.photos + result.photosImported } }
            : s
        ))
        // Rafraîchir les photos pending via SWR
        await refreshAllData()
      } else if (result.photosSkipped > 0) {
        toast.success(`Aucune nouvelle photo (${result.photosSkipped} doublon(s))`, { id: toastId })
      } else {
        toast.success('Aucune photo trouvée', { id: toastId })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du scraping', { id: toastId })
    } finally {
      setIsScraping(false)
      setScrapingSourceId(null)
    }
  }

  // Scraper toutes les sources
  const handleScrapeAll = async () => {
    if (isScraping || sources.length === 0) return

    setIsScraping(true)
    const toastId = toast.loading('Scraping de toutes les sources...')

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du scraping')
      }

      const totals = data.totals as {
        photosFound: number
        photosImported: number
        photosSkipped: number
        errors: number
      }

      let message = ''
      if (totals.photosImported > 0) {
        message = `${totals.photosImported} photo(s) importée(s) au total`
        // Rafraîchir les photos pending via SWR
        await refreshAllData()
      } else if (totals.photosSkipped > 0) {
        message = `Aucune nouvelle photo (${totals.photosSkipped} doublon(s))`
      } else {
        message = 'Aucune photo trouvée'
      }

      if (totals.errors > 0) {
        message += ` (${totals.errors} erreur(s))`
      }

      toast.success(message, { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du scraping', { id: toastId })
    } finally {
      setIsScraping(false)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 h-fit">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sources Instagram</h2>
            </div>
            {sources.length > 0 && (
              <button
                onClick={handleScrapeAll}
                disabled={isScraping}
                className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                title="Scraper toutes les sources"
              >
                <RefreshCw className={`w-4 h-4 ${isScraping && !scrapingSourceId ? 'animate-spin' : ''}`} />
                {isScraping && !scrapingSourceId ? 'Scraping...' : 'Scraper tout'}
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {sources.length === 0 ? (
            <EmptyState
              message="Aucune source ajoutée"
              icon={<Users className="w-12 h-12" />}
            />
          ) : (
            <ul className="space-y-2">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">@{source.username}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({source._count.photos} photos)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Bouton scraper individuel */}
                    <button
                      onClick={() => handleScrapeOne(source.id, source.username)}
                      disabled={isScraping}
                      className={`p-1.5 rounded transition-colors ${
                        scrapingSourceId === source.id
                          ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/30'
                          : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 opacity-0 group-hover:opacity-100'
                      } disabled:cursor-not-allowed`}
                      title="Scraper ce compte"
                    >
                      <RefreshCw className={`w-4 h-4 ${scrapingSourceId === source.id ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Bouton supprimer */}
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, source })}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Formulaire d'ajout */}
          <form onSubmit={handleAdd} className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {isLoading ? '...' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, source: null })}
        onConfirm={handleDelete}
        title="Supprimer cette source ?"
        message={`Voulez-vous vraiment supprimer @${deleteModal.source?.username} et toutes ses photos associées ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
      />
    </>
  )
}
