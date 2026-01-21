'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Clock, Upload, Check, X, CheckSquare, Square, XSquare, Loader2, Layers, ChevronLeft, ChevronRight, ZoomIn, ExternalLink } from 'lucide-react'
import { EmptyState } from './ui/EmptyState'
import { ConfirmModal } from './ui/ConfirmModal'

interface PendingPhoto {
  id: string
  originalUrl: string
  localPath: string | null
  status: string
  createdAt: string
  instagramPostUrl: string | null
  // Champs carrousel
  isCarousel: boolean
  carouselId: string | null
  carouselIndex: number | null
  carouselTotal: number | null
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

  // État pour suivre la photo en cours de traitement (approve + describe + generate)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // État pour la modal de confirmation de rejet
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; photoIds: string[] }>({
    isOpen: false,
    photoIds: [],
  })

  // État pour la modal d'aperçu (clic sur image pour agrandir)
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    imageUrl: string | null
    allImages: string[]  // Pour la navigation entre images
    currentIndex: number
  }>({
    isOpen: false,
    imageUrl: null,
    allImages: [],
    currentIndex: 0,
  })

  // État pour suivre le carrousel en cours de traitement
  const [processingCarouselId, setProcessingCarouselId] = useState<string | null>(null)

  /**
   * Retourne l'URL proxifiée pour les images externes (CORS)
   * Les URLs locales (/uploads/...) passent directement
   */
  const getProxiedUrl = useCallback((url: string) => {
    // Si c'est une URL locale, pas besoin de proxy
    if (url.startsWith('/') || url.startsWith('blob:')) {
      return url
    }
    // Pour les URLs externes (Instagram), utiliser le proxy
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
  }, [])

  /**
   * Ouvre la modal d'aperçu pour une image
   * Prend en charge la navigation entre toutes les images ou un sous-ensemble (carrousel)
   */
  const openPreview = useCallback((imageUrl: string, imageSet?: string[]) => {
    // Si on passe un set d'images (carrousel), utiliser celui-ci
    // Sinon utiliser toutes les images disponibles
    const allImages = imageSet || photos.map(p => p.localPath || p.originalUrl)
    const currentIndex = allImages.indexOf(imageUrl)

    setPreviewModal({
      isOpen: true,
      imageUrl,
      allImages,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    })
  }, [photos])

  /**
   * Navigation dans la modal d'aperçu
   */
  const navigatePreview = useCallback((direction: 'prev' | 'next') => {
    setPreviewModal(prev => {
      if (!prev.isOpen || prev.allImages.length <= 1) return prev

      let newIndex = prev.currentIndex
      if (direction === 'prev') {
        newIndex = prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.allImages.length - 1
      } else {
        newIndex = prev.currentIndex < prev.allImages.length - 1 ? prev.currentIndex + 1 : 0
      }

      return {
        ...prev,
        currentIndex: newIndex,
        imageUrl: prev.allImages[newIndex],
      }
    })
  }, [])

  // Regrouper les photos par carrousel
  const groupedPhotos = useMemo(() => {
    const groups: Map<string, PendingPhoto[]> = new Map()
    const singles: PendingPhoto[] = []

    photos.forEach(photo => {
      if (photo.isCarousel && photo.carouselId) {
        const existing = groups.get(photo.carouselId) || []
        existing.push(photo)
        groups.set(photo.carouselId, existing.sort((a, b) =>
          (a.carouselIndex || 0) - (b.carouselIndex || 0)
        ))
      } else {
        singles.push(photo)
      }
    })

    return { groups, singles }
  }, [photos])

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

  // Approuver une photo (workflow complet : approve + describe + generate)
  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id)
    const toastId = toast.loading('Validation et génération en cours...', { duration: Infinity })

    try {
      const res = await fetch(`/api/photos/${id}/approve`, {
        method: 'PATCH'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Échec du traitement')
      }

      setPhotos(prev => prev.filter(p => p.id !== id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      toast.success('Photo validée et générée !', { id: toastId })
      router.refresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors du traitement'
      toast.error(errorMsg, { id: toastId })
      console.error('Error in approve workflow:', err)
    } finally {
      setProcessingId(null)
    }
  }, [router])

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

  // Approuver la sélection (workflow complet pour chaque photo)
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    const total = selectedIds.size
    let successCount = 0
    let errorCount = 0

    const toastId = toast.loading(`Traitement de ${total} photo(s)... (0/${total})`, { duration: Infinity })

    const idsArray = Array.from(selectedIds)
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i]
      toast.loading(`Traitement de ${total} photo(s)... (${i + 1}/${total})`, { id: toastId })

      try {
        const res = await fetch(`/api/photos/${id}/approve`, {
          method: 'PATCH'
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Échec du traitement')
        }

        setPhotos(prev => prev.filter(p => p.id !== id))
        successCount++
      } catch (err) {
        errorCount++
        console.error('Error in approve workflow:', err)
      }
    }

    setSelectedIds(new Set())
    setIsProcessing(false)

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} photo(s) traitée(s) avec succès !`, { id: toastId })
      router.refresh()
    } else if (successCount > 0) {
      toast.success(`${successCount} photo(s) traitée(s), ${errorCount} erreur(s)`, { id: toastId })
      router.refresh()
    } else {
      toast.error(`Échec du traitement (${errorCount} erreur(s))`, { id: toastId })
    }
  }

  // Rejeter la sélection (ouvre la modal)
  const handleRejectSelected = () => {
    if (selectedIds.size === 0) return
    setRejectModal({ isOpen: true, photoIds: Array.from(selectedIds) })
  }

  // Approuver tout le carrousel (appel unique à l'endpoint carrousel)
  const handleApproveCarousel = async (carouselPhotos: PendingPhoto[]) => {
    if (carouselPhotos.length === 0) return

    const carouselId = carouselPhotos[0].carouselId
    setProcessingCarouselId(carouselId)

    const total = carouselPhotos.length
    const toastId = toast.loading(`Traitement du carrousel (${total} photos)...`, { duration: Infinity })

    try {
      // Appel unique à l'endpoint carrousel avec tous les IDs
      const res = await fetch('/api/photos/approve-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: carouselPhotos.map(p => p.id) })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Échec du traitement')
      }

      // Retirer toutes les photos du carrousel de l'état local
      const photoIds = carouselPhotos.map(p => p.id)
      setPhotos(prev => prev.filter(p => !photoIds.includes(p.id)))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        photoIds.forEach(id => newSet.delete(id))
        return newSet
      })

      toast.success(`Carrousel validé et généré (${total} photos) !`, { id: toastId })
      router.refresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors du traitement'
      toast.error(errorMsg, { id: toastId })
      console.error('Error in carousel approve workflow:', err)
    } finally {
      setProcessingCarouselId(null)
    }
  }

  // Rejeter tout le carrousel (ouvre la modal de confirmation)
  const handleRejectCarousel = (carouselPhotos: PendingPhoto[]) => {
    if (carouselPhotos.length === 0) return
    setRejectModal({ isOpen: true, photoIds: carouselPhotos.map(p => p.id) })
  }

  // Raccourcis clavier
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Gestion de la modal d'aperçu
    if (previewModal.isOpen) {
      if (e.key === 'Escape') {
        setPreviewModal({ isOpen: false, imageUrl: null, allImages: [], currentIndex: 0 })
      } else if (e.key === 'ArrowLeft') {
        navigatePreview('prev')
      } else if (e.key === 'ArrowRight') {
        navigatePreview('next')
      }
      return
    }

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
  }, [photos, currentPhotoIndex, previewModal.isOpen, navigatePreview, handleApprove])

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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Photos à valider
                {photos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({photos.length})
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={sources.length === 0}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
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
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
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

          {/* Aide raccourcis et workflow */}
          {photos.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Valider = Décrire + Générer automatiquement
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Raccourcis : ← → naviguer | A approuver | R rejeter
              </p>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {photos.length === 0 ? (
            <EmptyState
              message="Aucune photo en attente"
              icon={<Clock className="w-12 h-12" />}
            />
          ) : (
            <>
              {/* Affichage des carrousels groupés */}
              {Array.from(groupedPhotos.groups.entries()).map(([carouselId, carouselPhotos]) => {
                // Préparer les URLs des images du carrousel pour la navigation
                const carouselImageUrls = carouselPhotos.map(p => p.localPath || p.originalUrl)

                return (
                  <div
                    key={carouselId}
                    className={`border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/30 ${
                      processingCarouselId === carouselId ? 'opacity-75' : ''
                    }`}
                  >
                    {/* En-tête du carrousel */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          Carrousel ({carouselPhotos.length} photos)
                        </span>
                        {carouselPhotos[0]?.instagramPostUrl ? (
                          <a
                            href={carouselPhotos[0].instagramPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{carouselPhotos[0]?.source.username}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            @{carouselPhotos[0]?.source.username}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApproveCarousel(carouselPhotos)}
                          disabled={processingCarouselId !== null || processingId !== null || isProcessing}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          {processingCarouselId === carouselId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Valider tout
                        </button>
                        <button
                          onClick={() => handleRejectCarousel(carouselPhotos)}
                          disabled={processingCarouselId !== null || processingId !== null || isProcessing}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Rejeter tout
                        </button>
                      </div>
                    </div>

                    {/* Images du carrousel en scroll horizontal */}
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {carouselPhotos.map((photo) => (
                        <div key={photo.id} className="relative flex-shrink-0 w-32">
                          <div
                            className="relative w-32 h-40 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
                            onClick={() => openPreview(photo.localPath || photo.originalUrl, carouselImageUrls)}
                          >
                            {/* Overlay de traitement */}
                            {processingId === photo.id && (
                              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                              </div>
                            )}

                            {/* Overlay hover pour zoom */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all z-10">
                              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            {/* Badge position dans le carrousel */}
                            <span className="absolute top-1.5 left-1.5 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full z-10 font-medium">
                              {(photo.carouselIndex || 0) + 1}/{photo.carouselTotal}
                            </span>

                            {/* Checkbox de sélection */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleSelection(photo.id)
                              }}
                              disabled={processingId !== null || processingCarouselId !== null}
                              className={`absolute top-1.5 right-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10 ${
                                selectedIds.has(photo.id)
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-white/80 border-gray-300 hover:border-blue-400'
                              } disabled:opacity-50`}
                            >
                              {selectedIds.has(photo.id) && (
                                <Check className="w-3 h-3" strokeWidth={3} />
                              )}
                            </button>

                            <Image
                              src={photo.localPath || photo.originalUrl}
                              alt={`Carrousel photo ${(photo.carouselIndex || 0) + 1}`}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          </div>

                          {/* Boutons individuels */}
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => handleApprove(photo.id)}
                              disabled={processingId !== null || processingCarouselId !== null || isProcessing}
                              className={`flex-1 py-1.5 text-white rounded-lg transition-colors flex items-center justify-center ${
                                processingId === photo.id
                                  ? 'bg-green-400 cursor-wait'
                                  : 'bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              {processingId === photo.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => setRejectModal({ isOpen: true, photoIds: [photo.id] })}
                              disabled={processingId !== null || processingCarouselId !== null || isProcessing}
                              className="flex-1 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Affichage des photos individuelles */}
              {groupedPhotos.singles.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {groupedPhotos.singles.map((photo, index) => (
                    <div
                      key={photo.id}
                      className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border overflow-hidden transition-all ${
                        selectedIds.has(photo.id)
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : index === currentPhotoIndex
                          ? 'border-purple-400 ring-1 ring-purple-200 dark:ring-purple-800'
                          : 'border-gray-100 dark:border-gray-800 hover:shadow-md'
                      }`}
                    >
                      <div
                        className="aspect-square relative bg-gray-100 dark:bg-gray-800 cursor-pointer group"
                        onClick={() => {
                          setCurrentPhotoIndex(index)
                          openPreview(photo.localPath || photo.originalUrl)
                        }}
                      >
                        {/* Overlay de traitement */}
                        {processingId === photo.id && (
                          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                            <span className="text-white text-xs mt-2 font-medium">Génération...</span>
                          </div>
                        )}

                        {/* Overlay hover pour zoom */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all z-10 pointer-events-none">
                          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Checkbox de sélection */}
                        <div className="absolute top-2 left-2 z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelection(photo.id)
                            }}
                            disabled={processingId !== null}
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

                        {/* Badge pending */}
                        <div className="absolute top-2 right-2 z-20">
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
                        {photo.instagramPostUrl ? (
                          <a
                            href={photo.instagramPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{photo.source.username}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{photo.source.username}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApprove(photo.id)
                            }}
                            disabled={processingId !== null || isProcessing}
                            className={`flex-1 py-1.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                              processingId === photo.id
                                ? 'bg-green-400 cursor-wait'
                                : 'bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            {processingId === photo.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setRejectModal({ isOpen: true, photoIds: [photo.id] })
                            }}
                            disabled={processingId !== null || isProcessing}
                            className="flex-1 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                          >
                            <X className="w-4 h-4" />
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

      {/* Modal d'upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload manuel</h3>

            {sources.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Ajoutez d&apos;abord une source Instagram
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Source
                  </label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        @{source.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    disabled={isUploading}
                    className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Annuler
              </button>
            </div>

            {isUploading && (
              <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
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

      {/* Modal d'aperçu d'image (plein écran) */}
      {previewModal.isOpen && previewModal.imageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setPreviewModal({ isOpen: false, imageUrl: null, allImages: [], currentIndex: 0 })}
        >
          {/* Bouton fermer */}
          <button
            onClick={() => setPreviewModal({ isOpen: false, imageUrl: null, allImages: [], currentIndex: 0 })}
            className="absolute top-4 right-4 z-[101] bg-white/20 hover:bg-white/40 rounded-full p-2 transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Navigation précédent */}
          {previewModal.allImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigatePreview('prev')
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[101] bg-white/20 hover:bg-white/40 rounded-full p-2 transition"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Image - via proxy pour les URLs externes (CORS) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getProxiedUrl(previewModal.imageUrl)}
            alt="Aperçu"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Navigation suivant */}
          {previewModal.allImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigatePreview('next')
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[101] bg-white/20 hover:bg-white/40 rounded-full p-2 transition"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Indicateur de position */}
          {previewModal.allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full">
              {previewModal.currentIndex + 1} / {previewModal.allImages.length}
            </div>
          )}

          {/* Aide clavier */}
          <div className="absolute bottom-4 right-4 text-white/50 text-xs">
            Échap pour fermer • ← → pour naviguer
          </div>
        </div>
      )}
    </>
  )
}
