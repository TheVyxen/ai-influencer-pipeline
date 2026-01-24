'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { ConfirmModal } from './ui/ConfirmModal'
import toast from 'react-hot-toast'
import { useVideoSources, refreshVideoSources, VideoSource } from '@/lib/hooks/use-videos'

/**
 * Composant pour uploader des images sources pour la génération vidéo
 * Supporte le drag & drop et l'upload classique
 */
export function VideoUpload() {
  const { sources, isLoading, isError } = useVideoSources()
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VideoSource | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Gestion du drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )

    if (files.length === 0) {
      toast.error('Aucune image valide trouvée')
      return
    }

    await uploadFiles(files)
  }, [])

  // Upload des fichiers
  const uploadFiles = async (files: File[]) => {
    setUploading(true)
    let successCount = 0

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/videos/sources', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        successCount++
      } catch (error) {
        toast.error(`Erreur: ${file.name} - ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploadée(s)`)
      await refreshVideoSources()
    }

    setUploading(false)
  }

  // Gestion de l'input file
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    await uploadFiles(Array.from(files))
    e.target.value = '' // Reset input
  }

  // Suppression d'une source
  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/videos/sources/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Delete failed')
      }

      toast.success('Image supprimée')
      await refreshVideoSources()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de suppression')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Images sources
      </h2>

      {/* Zone de drag & drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          }
        `}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {uploading ? 'Upload en cours...' : 'Glissez vos images ici ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            JPEG, PNG ou WebP - Max 20MB
          </p>
        </div>
      </div>

      {/* Liste des images uploadées */}
      {isLoading && (
        <div className="text-center py-4 text-gray-500">
          Chargement...
        </div>
      )}

      {isError && (
        <div className="text-center py-4 text-red-500">
          Erreur de chargement
        </div>
      )}

      {!isLoading && sources.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          Aucune image uploadée
        </div>
      )}

      {sources.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="relative group aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
            >
              {/* Image preview */}
              <img
                src={`/api/videos/sources/${source.id}/image`}
                alt={source.originalName}
                className="w-full h-full object-cover"
              />

              {/* Overlay avec nom et bouton supprimer */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs text-white truncate">
                    {source.originalName}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(source)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
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
        title="Supprimer l'image"
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.originalName}" ? Les vidéos générées à partir de cette image seront également supprimées.`}
        confirmText="Supprimer"
        isLoading={deleting}
      />
    </div>
  )
}
