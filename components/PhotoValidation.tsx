'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Clock, Upload, Check, X, CheckSquare, Square, XSquare } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'
import { ConfirmModal } from './ui/ConfirmModal'

interface PendingPhoto {
  id: string
  originalUrl: string
  localPath: string | null
  status: string
  createdAt: string
  source: {
    username: string
  }
}

interface Source {
  id: string
  username: string
}

interface PhotoValidationProps {
  initialPhotos: PendingPhoto[]
  sources: Source[]
}

/**
 * Colonne centrale : Photos à valider avec sélection en lot
 */
export function PhotoValidation({ initialPhotos, sources }: PhotoValidationProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PendingPhoto[]>(initialPhotos)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '')
  const [showUploadModal, setShowUploadModal] = useState(false)

  // États pour la sélection en lot
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  // État pour la modal de confirmation de rejet
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; photoIds: string[] }>({
    isOpen: false,
    photoIds: [],
  })

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

  // Approuver une photo
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/photos/${id}/approve`, {
        method: 'PATCH'
      })

      if (!res.ok) throw new Error('Failed to approve')

      setPhotos(prev => prev.filter(p => p.id !== id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      toast.success('Photo approuvée')
      router.refresh()
    } catch (err) {
      toast.error('Erreur lors de l\'approbation')
      console.error('Error approving photo:', err)
    }
  }

  // Rejeter une photo (avec confirmation)
  const handleReject = async (ids: string[]) => {
    setIsProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const id of ids) {
      try {
        const res = await fetch(`/api/photos/${id}/reject`, {
          method: 'PATCH'
        })

        if (!res.ok) throw new Error('Failed to reject')

        setPhotos(prev => prev.filter(p => p.id !== id))
        setSelectedIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        successCount++
      } catch (err) {
        errorCount++
        console.error('Error rejecting photo:', err)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} photo(s) rejetée(s)`)
      router.refresh()
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors du rejet`)
    }

    setIsProcessing(false)
    setRejectModal({ isOpen: false, photoIds: [] })
  }

  // Approuver la sélection
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    const toastId = toast.loading(`Approbation de ${selectedIds.size} photo(s)...`)
    let successCount = 0
    let errorCount = 0

    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`/api/photos/${id}/approve`, {
          method: 'PATCH'
        })

        if (!res.ok) throw new Error('Failed to approve')

        setPhotos(prev => prev.filter(p => p.id !== id))
        successCount++
      } catch (err) {
        errorCount++
        console.error('Error approving photo:', err)
      }
    }

    setSelectedIds(new Set())
    setIsProcessing(false)

    if (successCount > 0) {
      toast.success(`${successCount} photo(s) approuvée(s)`, { id: toastId })
      router.refresh()
    } else {
      toast.error('Erreur lors de l\'approbation', { id: toastId })
    }
  }

  // Rejeter la sélection (ouvre la modal)
  const handleRejectSelected = () => {
    if (selectedIds.size === 0) return
    setRejectModal({ isOpen: true, photoIds: Array.from(selectedIds) })
  }

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (photos.length === 0) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.key === 'ArrowLeft') {
      setCurrentPhotoIndex(prev => Math.max(0, prev - 1))
    } else if (e.key === 'ArrowRight') {
      setCurrentPhotoIndex(prev => Math.min(photos.length - 1, prev + 1))
    } else if (e.key === 'a' || e.key === 'A') {
      if (photos[currentPhotoIndex]) {
        handleApprove(photos[currentPhotoIndex].id)
        setCurrentPhotoIndex(prev => Math.min(photos.length - 2, prev))
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (photos[currentPhotoIndex]) {
        setRejectModal({ isOpen: true, photoIds: [photos[currentPhotoIndex].id] })
      }
    }
  }, [photos, currentPhotoIndex])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Upload manuel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSourceId) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceId', selectedSourceId)

      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Failed to upload')

      const newPhoto = await res.json()
      setPhotos(prev => [newPhoto, ...prev])
      setShowUploadModal(false)
      toast.success('Photo uploadée avec succès')
      router.refresh()
    } catch (err) {
      toast.error('Erreur lors de l\'upload')
      console.error('Error uploading photo:', err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Photos à valider
                {photos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({photos.length})
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={sources.length === 0}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>

          {/* Barre d'actions en lot */}
          {photos.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                {selectedIds.size === photos.length ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === photos.length ? 'Désélectionner' : 'Tout sélectionner'}
              </button>

              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleApproveSelected}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Valider ({selectedIds.size})
                  </button>
                  <button
                    onClick={handleRejectSelected}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <XSquare className="w-3.5 h-3.5" />
                    Rejeter ({selectedIds.size})
                  </button>
                </>
              )}
            </div>
          )}

          {/* Aide raccourcis */}
          {photos.length > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              Raccourcis : ← → naviguer | A approuver | R rejeter
            </p>
          )}
        </div>

        <div className="p-4">
          {photos.length === 0 ? (
            <EmptyState
              message="Aucune photo en attente"
              icon={<Clock className="w-12 h-12" />}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all cursor-pointer ${
                    selectedIds.has(photo.id)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : index === currentPhotoIndex
                      ? 'border-purple-400 ring-1 ring-purple-200'
                      : 'border-gray-100 hover:shadow-md'
                  }`}
                  onClick={() => setCurrentPhotoIndex(index)}
                >
                  <div className="aspect-square relative bg-gray-100">
                    {/* Checkbox de sélection */}
                    <div className="absolute top-2 left-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelection(photo.id)
                        }}
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

                    {/* Badge pending */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                        En attente
                      </span>
                    </div>

                    <Image
                      src={photo.localPath || photo.originalUrl}
                      alt="Photo à valider"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 200px"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 truncate">@{photo.source.username}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApprove(photo.id)
                        }}
                        className="flex-1 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRejectModal({ isOpen: true, photoIds: [photo.id] })
                        }}
                        className="flex-1 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal d'upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload manuel</h3>

            {sources.length === 0 ? (
              <p className="text-gray-500 text-sm mb-4">
                Ajoutez d&apos;abord une source Instagram
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        @{source.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    disabled={isUploading}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annuler
              </button>
            </div>

            {isUploading && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Upload en cours...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmation de rejet */}
      <ConfirmModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, photoIds: [] })}
        onConfirm={() => handleReject(rejectModal.photoIds)}
        title={rejectModal.photoIds.length > 1 ? 'Rejeter ces photos ?' : 'Rejeter cette photo ?'}
        message={`Voulez-vous vraiment rejeter ${rejectModal.photoIds.length > 1 ? `ces ${rejectModal.photoIds.length} photos` : 'cette photo'} ? Cette action est irréversible.`}
        confirmText="Rejeter"
        variant="danger"
        isLoading={isProcessing}
      />
    </>
  )
}
