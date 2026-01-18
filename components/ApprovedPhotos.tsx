'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { CheckCircle, Search, Sparkles, Eye, Copy, X, Check, Square, CheckSquare } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'

interface ApprovedPhoto {
  id: string
  originalUrl: string
  localPath: string | null
  status: string
  generatedPrompt: string | null
  createdAt: string
  source: {
    username: string
  }
}

interface ApprovedPhotosProps {
  initialPhotos: ApprovedPhoto[]
}

type LoadingState = {
  id: string
  action: 'describe' | 'generate'
} | null

/**
 * Section des photos approuvées avec boutons de description et génération
 * Supporte les actions en lot
 */
export function ApprovedPhotos({ initialPhotos }: ApprovedPhotosProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState<ApprovedPhoto[]>(initialPhotos)
  const [loadingState, setLoadingState] = useState<LoadingState>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<{ id: string; prompt: string } | null>(null)

  // États pour la sélection en lot
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState<{ action: 'describe' | 'generate'; progress: number; total: number } | null>(null)

  // Toggle sélection d'une photo
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Tout sélectionner / Désélectionner
  const toggleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)))
    }
  }

  // Générer la description d'une photo via Gemini
  const handleDescribe = async (photoId: string) => {
    setLoadingState({ id: photoId, action: 'describe' })

    try {
      const res = await fetch(`/api/photos/${photoId}/describe`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la description')
      }

      setPhotos(prev =>
        prev.map(p =>
          p.id === photoId ? { ...p, generatedPrompt: data.prompt } : p
        )
      )
      toast.success('Description générée avec succès')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoadingState(null)
    }
  }

  // Générer l'image via Wavespeed
  const handleGenerate = async (photoId: string) => {
    setLoadingState({ id: photoId, action: 'generate' })

    try {
      const res = await fetch(`/api/photos/${photoId}/generate`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la génération')
      }

      toast.success('Image générée avec succès')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoadingState(null)
    }
  }

  // Décrire la sélection en lot
  const handleDescribeSelected = async () => {
    if (selectedIds.size === 0) return

    const photosToDescribe = photos.filter(p => selectedIds.has(p.id) && !p.generatedPrompt)
    if (photosToDescribe.length === 0) {
      toast.error('Toutes les photos sélectionnées ont déjà une description')
      return
    }

    setBatchProcessing({ action: 'describe', progress: 0, total: photosToDescribe.length })
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < photosToDescribe.length; i++) {
      const photo = photosToDescribe[i]
      setBatchProcessing({ action: 'describe', progress: i + 1, total: photosToDescribe.length })

      try {
        const res = await fetch(`/api/photos/${photo.id}/describe`, {
          method: 'POST'
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erreur')
        }

        setPhotos(prev =>
          prev.map(p =>
            p.id === photo.id ? { ...p, generatedPrompt: data.prompt } : p
          )
        )
        successCount++
      } catch (err) {
        errorCount++
        console.error(`Error describing photo ${photo.id}:`, err)
      }
    }

    setBatchProcessing(null)
    setSelectedIds(new Set())

    if (successCount > 0) {
      toast.success(`${successCount} photo(s) décrite(s)`)
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de la description`)
    }
  }

  // Générer la sélection en lot
  const handleGenerateSelected = async () => {
    if (selectedIds.size === 0) return

    const photosToGenerate = photos.filter(p => selectedIds.has(p.id) && p.generatedPrompt)
    if (photosToGenerate.length === 0) {
      toast.error('Aucune photo sélectionnée n\'a de prompt')
      return
    }

    setBatchProcessing({ action: 'generate', progress: 0, total: photosToGenerate.length })
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < photosToGenerate.length; i++) {
      const photo = photosToGenerate[i]
      setBatchProcessing({ action: 'generate', progress: i + 1, total: photosToGenerate.length })

      try {
        const res = await fetch(`/api/photos/${photo.id}/generate`, {
          method: 'POST'
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erreur')
        }

        successCount++
      } catch (err) {
        errorCount++
        console.error(`Error generating photo ${photo.id}:`, err)
      }
    }

    setBatchProcessing(null)
    setSelectedIds(new Set())

    if (successCount > 0) {
      toast.success(`${successCount} image(s) générée(s)`)
      router.refresh()
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de la génération`)
    }
  }

  // Copier le prompt
  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt copié')
  }

  const isLoading = (photoId: string, action: 'describe' | 'generate') =>
    loadingState?.id === photoId && loadingState?.action === action

  const isBatchProcessing = batchProcessing !== null

  // Compter les photos sélectionnées avec/sans prompt
  const selectedWithPrompt = photos.filter(p => selectedIds.has(p.id) && p.generatedPrompt).length
  const selectedWithoutPrompt = photos.filter(p => selectedIds.has(p.id) && !p.generatedPrompt).length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Photos approuvées
            {photos.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({photos.length})
              </span>
            )}
          </h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          1. Décrire avec Gemini → 2. Générer avec Wavespeed
        </p>

        {/* Barre d'actions en lot */}
        {photos.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleSelectAll}
              disabled={isBatchProcessing}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {selectedIds.size === photos.length ? (
                <CheckSquare className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              {selectedIds.size === photos.length ? 'Désélectionner' : 'Tout sélectionner'}
            </button>

            {selectedIds.size > 0 && !isBatchProcessing && (
              <>
                {selectedWithoutPrompt > 0 && (
                  <button
                    onClick={handleDescribeSelected}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Décrire ({selectedWithoutPrompt})
                  </button>
                )}
                {selectedWithPrompt > 0 && (
                  <button
                    onClick={handleGenerateSelected}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Générer ({selectedWithPrompt})
                  </button>
                )}
              </>
            )}

            {/* Barre de progression pour le traitement en lot */}
            {isBatchProcessing && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>
                  {batchProcessing.action === 'describe' ? 'Description' : 'Génération'} {batchProcessing.progress}/{batchProcessing.total}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {photos.length === 0 ? (
          <EmptyState
            message="Aucune photo approuvée"
            icon={<CheckCircle className="w-12 h-12" />}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all ${
                  selectedIds.has(photo.id)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-100 hover:shadow-md'
                }`}
              >
                <div className="aspect-square relative bg-gray-100">
                  {/* Checkbox de sélection */}
                  <div className="absolute top-2 left-2 z-10">
                    <button
                      onClick={() => toggleSelection(photo.id)}
                      disabled={isBatchProcessing}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedIds.has(photo.id)
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-white/80 border-gray-300 hover:border-blue-400'
                      } disabled:opacity-50`}
                    >
                      {selectedIds.has(photo.id) && (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      )}
                    </button>
                  </div>

                  {/* Badge de statut */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      photo.generatedPrompt
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {photo.generatedPrompt ? 'Prêt' : 'À décrire'}
                    </span>
                  </div>

                  {/* Indicateur de prompt existant */}
                  {photo.generatedPrompt && (
                    <button
                      onClick={() => setSelectedPrompt({ id: photo.id, prompt: photo.generatedPrompt! })}
                      className="absolute bottom-2 right-2 bg-green-500 text-white p-1.5 rounded-full shadow-lg hover:bg-green-600 transition-colors z-10"
                      title="Voir le prompt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  <Image
                    src={photo.localPath || photo.originalUrl}
                    alt="Photo approuvée"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 200px"
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-500 truncate">@{photo.source.username}</p>

                  {/* Boutons d'action */}
                  <div className="mt-2 space-y-2">
                    {/* Si pas de prompt : bouton Décrire */}
                    {!photo.generatedPrompt ? (
                      <button
                        onClick={() => handleDescribe(photo.id)}
                        disabled={loadingState !== null || isBatchProcessing}
                        className="w-full py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                      >
                        {isLoading(photo.id, 'describe') ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Analyse...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            Décrire
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        {/* Bouton voir prompt */}
                        <button
                          onClick={() => setSelectedPrompt({ id: photo.id, prompt: photo.generatedPrompt! })}
                          className="w-full py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Voir prompt
                        </button>

                        {/* Bouton Générer */}
                        <button
                          onClick={() => handleGenerate(photo.id)}
                          disabled={loadingState !== null || isBatchProcessing}
                          className="w-full py-1.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                        >
                          {isLoading(photo.id, 'generate') ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Génération...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Générer
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal pour afficher le prompt */}
      {selectedPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Prompt généré</h3>
              <button
                onClick={() => setSelectedPrompt(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedPrompt.prompt}
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => handleCopyPrompt(selectedPrompt.prompt)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                <Copy className="w-4 h-4" />
                Copier
              </button>
              <button
                onClick={() => setSelectedPrompt(null)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
