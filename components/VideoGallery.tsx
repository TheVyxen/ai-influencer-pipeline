'use client'

import { useState, useEffect } from 'react'
import { Download, Trash2, Play, AlertCircle, Clock, CheckCircle, Loader2, Eye, RefreshCw } from 'lucide-react'
import { ConfirmModal } from './ui/ConfirmModal'
import { VideoPlayer } from './VideoPlayer'
import toast from 'react-hot-toast'
import { useGeneratedVideos, useVideoStatus, refreshGeneratedVideos, GeneratedVideo } from '@/lib/hooks/use-videos'

/**
 * Composant pour afficher la galerie des vidéos générées
 */
export function VideoGallery() {
  const { videos, isLoading, isError, mutate } = useGeneratedVideos()
  const [deleteTarget, setDeleteTarget] = useState<GeneratedVideo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewVideo, setPreviewVideo] = useState<GeneratedVideo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)

  // Trouver les vidéos en cours de traitement pour le polling
  const processingVideos = videos.filter(v => v.status === 'processing')

  // Polling automatique pour les vidéos en processing
  useEffect(() => {
    if (processingVideos.length === 0) return

    const interval = setInterval(async () => {
      // Vérifier le statut de chaque vidéo en processing
      for (const video of processingVideos) {
        try {
          const response = await fetch(`/api/videos/${video.id}/status`)
          if (response.ok) {
            const updatedVideo = await response.json()
            if (updatedVideo.status !== 'processing') {
              // Le statut a changé, rafraîchir la liste
              await mutate()
              if (updatedVideo.status === 'completed') {
                toast.success(`Vidéo "${video.source.originalName}" terminée !`)
              } else if (updatedVideo.status === 'failed') {
                toast.error(`Échec de la génération: ${updatedVideo.errorMessage || 'Erreur inconnue'}`)
              }
            }
          }
        } catch (error) {
          console.error('Error polling video status:', error)
        }
      }
    }, 10000) // Polling toutes les 10 secondes

    return () => clearInterval(interval)
  }, [processingVideos, mutate])

  // Suppression d'une vidéo
  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/videos/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Delete failed')
      }

      toast.success('Vidéo supprimée')
      await refreshGeneratedVideos()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de suppression')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Ouvrir la preview d'une vidéo
  const handlePreview = (video: GeneratedVideo) => {
    if (video.status !== 'completed') return

    // L'endpoint /download stream directement la vidéo
    setPreviewUrl(`/api/videos/${video.id}/download`)
    setPreviewVideo(video)
  }

  // Télécharger une vidéo
  const handleDownload = async (video: GeneratedVideo) => {
    if (video.status !== 'completed') return

    // Créer un lien temporaire pour télécharger
    const link = document.createElement('a')
    link.href = `/api/videos/${video.id}/download`
    link.download = `video-${video.source.originalName.replace(/\.[^/.]+$/, '')}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Relancer la génération d'une vidéo
  const handleRegenerate = async (video: GeneratedVideo) => {
    setRegenerating(video.id)
    try {
      const response = await fetch(`/api/videos/${video.sourceId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: video.prompt || undefined,
          aspectRatio: video.aspectRatio,
          duration: video.duration,
          resolution: video.resolution || '1080p',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur de régénération')
      }

      toast.success('Nouvelle génération lancée !')
      await refreshGeneratedVideos()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de régénération')
    } finally {
      setRegenerating(null)
    }
  }

  // Obtenir l'icône de statut
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  // Obtenir le label de statut
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente'
      case 'processing':
        return 'Génération...'
      case 'completed':
        return 'Terminé'
      case 'failed':
        return 'Échec'
      default:
        return status
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Vidéos générées
        </h2>
        {videos.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {videos.length} vidéo{videos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      )}

      {isError && (
        <div className="text-center py-8 text-red-500">
          Erreur de chargement
        </div>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Play className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Aucune vidéo générée</p>
          <p className="text-sm">Uploadez une image et lancez une génération</p>
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className={`
                relative rounded-lg overflow-hidden border
                ${video.status === 'failed'
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : video.status === 'processing'
                  ? 'border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }
              `}
            >
              {/* Preview de l'image source */}
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative">
                <img
                  src={`/api/videos/sources/${video.sourceId}/image`}
                  alt={video.source.originalName}
                  className={`w-full h-full object-cover ${video.status === 'processing' ? 'opacity-50' : ''}`}
                />

                {/* Overlay pour vidéos complétées */}
                {video.status === 'completed' && (
                  <button
                    onClick={() => handlePreview(video)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors group"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-gray-900 ml-1" />
                    </div>
                  </button>
                )}

                {/* Indicateur de processing */}
                {video.status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                      <span className="text-sm font-medium">Génération...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Informations */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(video.status)}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {getStatusLabel(video.status)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {video.duration}s - {video.aspectRatio}
                  </span>
                </div>

                {/* Message d'erreur */}
                {video.status === 'failed' && video.errorMessage && (
                  <p className="text-xs text-red-600 dark:text-red-400 truncate" title={video.errorMessage}>
                    {video.errorMessage}
                  </p>
                )}

                {/* Prompt utilisé */}
                {video.prompt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={video.prompt}>
                    {video.prompt}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {video.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handlePreview(video)}
                        className="p-1.5 text-gray-400 hover:text-purple-500 transition-colors"
                        title="Voir"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(video)}
                        className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {(video.status === 'completed' || video.status === 'failed') && (
                    <button
                      onClick={() => handleRegenerate(video)}
                      disabled={regenerating === video.id}
                      className="p-1.5 text-gray-400 hover:text-purple-500 transition-colors disabled:opacity-50"
                      title="Refaire"
                    >
                      <RefreshCw className={`w-4 h-4 ${regenerating === video.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(video)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la vidéo"
        message="Voulez-vous vraiment supprimer cette vidéo ? Cette action est irréversible."
        confirmText="Supprimer"
        isLoading={deleting}
      />

      {/* Player vidéo */}
      {previewVideo && previewUrl && (
        <VideoPlayer
          isOpen={true}
          onClose={() => {
            setPreviewVideo(null)
            setPreviewUrl(null)
          }}
          videoUrl={previewUrl}
          title={previewVideo.source.originalName}
          onDownload={() => handleDownload(previewVideo)}
        />
      )}
    </div>
  )
}
