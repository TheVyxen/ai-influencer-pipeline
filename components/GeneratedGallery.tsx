'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Sparkles, Eye, Download, Copy, X, Check, Trash2, FileText, Layers } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'
import { ConfirmModal } from './ui/ConfirmModal'

interface GeneratedPhoto {
  id: string
  prompt: string
  localPath: string | null
  createdAt: string
  // Champs carrousel
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

interface GeneratedGalleryProps {
  photos: GeneratedPhoto[]
}

/**
 * Section des photos generees via Gemini 3
 * Supporte l'affichage groupe des carrousels
 */
export function GeneratedGallery({ photos: initialPhotos }: GeneratedGalleryProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState<GeneratedPhoto[]>(initialPhotos)
  const [selectedPrompt, setSelectedPrompt] = useState<{ id: string; prompt: string } | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ id: string; url: string; prompt: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [downloadingCarouselId, setDownloadingCarouselId] = useState<string | null>(null)

  // Etat pour la modal de confirmation de suppression
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; photoIds: string[] }>({
    isOpen: false,
    photoIds: [],
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Regrouper les photos par carouselId
  const groupedPhotos = useMemo(() => {
    const carousels: Map<string, GeneratedPhoto[]> = new Map()
    const singles: GeneratedPhoto[] = []

    photos.forEach(photo => {
      if (photo.isCarousel && photo.carouselId) {
        const existing = carousels.get(photo.carouselId) || []
        existing.push(photo)
        carousels.set(photo.carouselId, existing.sort((a, b) =>
          (a.carouselIndex || 0) - (b.carouselIndex || 0)
        ))
      } else {
        singles.push(photo)
      }
    })

    return { carousels, singles }
  }, [photos])

  // Toggle selection d'une photo
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

  // Selectionner / Deselectionner tout
  const toggleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)))
    }
  }

  // Telecharger une photo via la nouvelle API
  const handleDownload = async (photo: GeneratedPhoto) => {
    const toastId = toast.loading('Preparation du telechargement...')

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
      toast.success('Photo telechargee', { id: toastId })
    } catch (err) {
      toast.error('Erreur lors du telechargement', { id: toastId })
      console.error('Error downloading photo:', err)
    }
  }

  // Telecharger les photos selectionnees en ZIP
  const handleDownloadZip = async (ids?: string[]) => {
    const idsToDownload = ids || Array.from(selectedIds)
    if (idsToDownload.length === 0) return

    if (ids) {
      // C'est un carrousel
      const carouselId = photos.find(p => p.id === ids[0])?.carouselId
      if (carouselId) setDownloadingCarouselId(carouselId)
    } else {
      setIsDownloadingZip(true)
    }

    const toastId = toast.loading(`Creation du ZIP (${idsToDownload.length} photos)...`)

    try {
      const response = await fetch('/api/photos/generated/download-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDownload })
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
      toast.success('ZIP telecharge avec succes', { id: toastId })
    } catch (err) {
      toast.error('Erreur lors de la creation du ZIP', { id: toastId })
      console.error('Error downloading ZIP:', err)
    } finally {
      setIsDownloadingZip(false)
      setDownloadingCarouselId(null)
    }
  }

  // Supprimer les photos selectionnees
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
      toast.success(`${successCount} photo(s) supprimee(s)`)
      router.refresh()
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
    toast.success('Prompt copie')
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 h-fit">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Photos generees
                  {photos.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({photos.length})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Images generees par Gemini
                </p>
              </div>
            </div>
          </div>

          {/* Boutons de selection et telechargement */}
          {photos.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {/* Bouton Tout selectionner / Deselectionner */}
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                {selectedIds.size === photos.length ? 'Tout deselectionner' : 'Tout selectionner'}
              </button>

              {/* Actions sur la selection */}
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => handleDownloadZip()}
                    disabled={isDownloadingZip}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isDownloadingZip ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creation...
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

        <div className="p-4 space-y-4">
          {photos.length === 0 ? (
            <EmptyState
              message="Aucune photo generee"
              icon={<Sparkles className="w-12 h-12" />}
            />
          ) : (
            <>
              {/* Affichage des carrousels groupes */}
              {Array.from(groupedPhotos.carousels.entries()).map(([carouselId, carouselPhotos]) => (
                <div
                  key={carouselId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
                >
                  {/* Header du carrousel */}
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                      Carrousel ({carouselPhotos.length} photos)
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Intl.DateTimeFormat('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(new Date(carouselPhotos[0].createdAt))}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleDownloadZip(carouselPhotos.map(p => p.id))}
                        disabled={downloadingCarouselId === carouselId}
                        className="px-3 py-1 text-xs font-medium text-white bg-purple-500 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        {downloadingCarouselId === carouselId ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </>
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        Telecharger tout
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, photoIds: carouselPhotos.map(p => p.id) })}
                        className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Images du carrousel en scroll horizontal */}
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {carouselPhotos.map((photo) => (
                      <div key={photo.id} className="relative flex-shrink-0">
                        <div
                          className="relative w-36 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                          onClick={() => setSelectedImage({
                            id: photo.id,
                            url: photo.localPath || `/api/images/generated/${photo.id}`,
                            prompt: photo.prompt
                          })}
                        >
                          {/* Badge position dans le carrousel */}
                          <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium">
                            {(photo.carouselIndex || 0) + 1}/{photo.carouselTotal}
                          </span>

                          {/* Checkbox de selection */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelection(photo.id)
                            }}
                            className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10 ${
                              selectedIds.has(photo.id)
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                            }`}
                          >
                            {selectedIds.has(photo.id) && (
                              <Check className="w-3 h-3" strokeWidth={3} />
                            )}
                          </button>

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.localPath || `/api/images/generated/${photo.id}`}
                            alt={`Carrousel photo ${(photo.carouselIndex || 0) + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </div>

                        {/* Boutons sous l'image */}
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() => setSelectedPrompt({ id: photo.id, prompt: photo.prompt })}
                            className="flex-1 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                            title="Voir le prompt"
                          >
                            <FileText className="w-3 h-3" />
                            Prompt
                          </button>
                          <button
                            onClick={() => handleDownload(photo)}
                            className="py-1 px-2 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                            title="Telecharger"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Affichage des photos individuelles */}
              {groupedPhotos.singles.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {groupedPhotos.singles.map((photo) => (
                    <div
                      key={photo.id}
                      className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border overflow-hidden hover:shadow-md dark:hover:shadow-gray-900 transition-all ${
                        selectedIds.has(photo.id)
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-100 dark:border-gray-800'
                      }`}
                    >
                      <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
                        {/* Checkbox de selection */}
                        <div className="absolute top-2 left-2 z-10">
                          <button
                            onClick={() => toggleSelection(photo.id)}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                              selectedIds.has(photo.id)
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                            }`}
                          >
                            {selectedIds.has(photo.id) && (
                              <Check className="w-4 h-4" strokeWidth={3} />
                            )}
                          </button>
                        </div>

                        {/* Badge genere */}
                        <div className="absolute top-2 right-2 z-10">
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded-full">
                            Generee
                          </span>
                        </div>

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.localPath || `/api/images/generated/${photo.id}`}
                          alt="Photo generee"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {new Intl.DateTimeFormat('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).format(new Date(photo.createdAt))}
                        </p>

                        <div className="mt-2 space-y-2">
                          {/* Bouton voir la photo + prompt */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedImage({
                                id: photo.id,
                                url: photo.localPath || `/api/images/generated/${photo.id}`,
                                prompt: photo.prompt
                              })}
                              className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              Voir
                            </button>
                            <button
                              onClick={() => setSelectedPrompt({ id: photo.id, prompt: photo.prompt })}
                              className="py-1.5 px-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              title="Voir le prompt"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Bouton telecharger */}
                          <button
                            onClick={() => handleDownload(photo)}
                            className="w-full py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Download className="w-4 h-4" />
                            Telecharger
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal pour afficher l'image en grand */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            {/* Bouton fermer */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.url}
              alt="Photo generee"
              className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto"
            />

            {/* Actions en bas */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setSelectedImage(null)
                  setSelectedPrompt({ id: selectedImage.id, prompt: selectedImage.prompt })
                }}
                className="px-4 py-2 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Voir le prompt
              </button>
              <button
                onClick={() => {
                  const photo = photos.find(p => p.id === selectedImage.id)
                  if (photo) handleDownload(photo)
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Telecharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour afficher le prompt */}
      {selectedPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Prompt utilise</h3>
              <button
                onClick={() => setSelectedPrompt(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedPrompt.prompt}
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => handleCopyPrompt(selectedPrompt.prompt)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
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
        message={`Voulez-vous vraiment supprimer ${deleteModal.photoIds.length > 1 ? `ces ${deleteModal.photoIds.length} photos generees` : 'cette photo generee'} ? Cette action est irreversible.`}
        confirmText="Supprimer"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  )
}
