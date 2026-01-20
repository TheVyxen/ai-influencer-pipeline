'use client'

import { useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Sparkles, Eye, Download, Copy, X, Check, Trash2 } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'
import { ConfirmModal } from './ui/ConfirmModal'

interface GeneratedPhoto {
  id: string
  prompt: string
  localPath: string
  createdAt: string
  sourcePhoto: {
    id: string
    source: {
      username: string
    }
  }
}

interface GeneratedGalleryProps {
  photos: GeneratedPhoto[]
}

/**
 * Section des photos générées via Gemini 3
 */
export function GeneratedGallery({ photos: initialPhotos }: GeneratedGalleryProps) {
  const [photos, setPhotos] = useState<GeneratedPhoto[]>(initialPhotos)
  const [selectedPrompt, setSelectedPrompt] = useState<{ id: string; prompt: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  // État pour la modal de confirmation de suppression
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; photoIds: string[] }>({
    isOpen: false,
    photoIds: [],
  })
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Sélectionner / Désélectionner tout
  const toggleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)))
    }
  }

  // Télécharger une photo via la nouvelle API
  const handleDownload = async (photo: GeneratedPhoto) => {
    const toastId = toast.loading('Préparation du téléchargement...')

    try {
      const response = await fetch(`/api/photos/generated/${photo.id}/download`)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo_generated_${photo.id}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Photo téléchargée', { id: toastId })
    } catch (err) {
      toast.error('Erreur lors du téléchargement', { id: toastId })
      console.error('Error downloading photo:', err)
    }
  }

  // Télécharger les photos sélectionnées en ZIP
  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) return

    setIsDownloadingZip(true)
    const toastId = toast.loading(`Création du ZIP (${selectedIds.size} photos)...`)

    try {
      const response = await fetch('/api/photos/generated/download-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })

      if (!response.ok) throw new Error('ZIP download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photos_generated_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('ZIP téléchargé avec succès', { id: toastId })
    } catch (err) {
      toast.error('Erreur lors de la création du ZIP', { id: toastId })
      console.error('Error downloading ZIP:', err)
    } finally {
      setIsDownloadingZip(false)
    }
  }

  // Supprimer les photos sélectionnées
  const handleDeleteSelected = async () => {
    setIsDeleting(true)
    let successCount = 0
    let errorCount = 0

    for (const id of deleteModal.photoIds) {
      try {
        const res = await fetch(`/api/photos/generated/${id}`, {
          method: 'DELETE'
        })

        if (!res.ok) throw new Error('Delete failed')

        setPhotos(prev => prev.filter(p => p.id !== id))
        setSelectedIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        successCount++
      } catch (err) {
        errorCount++
        console.error('Error deleting photo:', err)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} photo(s) supprimée(s)`)
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de la suppression`)
    }

    setIsDeleting(false)
    setDeleteModal({ isOpen: false, photoIds: [] })
  }

  // Copier le prompt
  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt copié')
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-fit">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Photos générées
                  {photos.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({photos.length})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-500">
                  Images générées par Gemini
                </p>
              </div>
            </div>
          </div>

          {/* Boutons de sélection et téléchargement */}
          {photos.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {/* Bouton Tout sélectionner / Désélectionner */}
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                {selectedIds.size === photos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>

              {/* Actions sur la sélection */}
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloadingZip}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isDownloadingZip ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Création...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        ZIP ({selectedIds.size})
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setDeleteModal({ isOpen: true, photoIds: Array.from(selectedIds) })}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer ({selectedIds.size})
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          {photos.length === 0 ? (
            <EmptyState
              message="Aucune photo générée"
              icon={<Sparkles className="w-12 h-12" />}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-all ${
                    selectedIds.has(photo.id)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="aspect-square relative bg-gray-100">
                    {/* Checkbox de sélection */}
                    <div className="absolute top-2 left-2 z-10">
                      <button
                        onClick={() => toggleSelection(photo.id)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedIds.has(photo.id)
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-white/80 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {selectedIds.has(photo.id) && (
                          <Check className="w-4 h-4" strokeWidth={3} />
                        )}
                      </button>
                    </div>

                    {/* Badge généré */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        Générée
                      </span>
                    </div>

                    <Image
                      src={photo.localPath}
                      alt="Photo générée"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 200px"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400">
                      {new Intl.DateTimeFormat('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(new Date(photo.createdAt))}
                    </p>

                    <div className="mt-2 space-y-2">
                      {/* Bouton voir prompt */}
                      <button
                        onClick={() => setSelectedPrompt({ id: photo.id, prompt: photo.prompt })}
                        className="w-full py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Voir prompt
                      </button>

                      {/* Bouton télécharger */}
                      <button
                        onClick={() => handleDownload(photo)}
                        className="w-full py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal pour afficher le prompt */}
      {selectedPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Prompt utilisé</h3>
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

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, photoIds: [] })}
        onConfirm={handleDeleteSelected}
        title={deleteModal.photoIds.length > 1 ? 'Supprimer ces photos ?' : 'Supprimer cette photo ?'}
        message={`Voulez-vous vraiment supprimer ${deleteModal.photoIds.length > 1 ? `ces ${deleteModal.photoIds.length} photos générées` : 'cette photo générée'} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  )
}
