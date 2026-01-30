'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Trash2, Check } from 'lucide-react'
import { Button } from './ui/button'
import { ConfirmModal } from './ui/ConfirmModal'
import toast from 'react-hot-toast'
import { useVideoSources, refreshVideoSources, VideoSource } from '@/lib/hooks/use-videos'

interface VideoUploadProps {
  selectedSourceId: string
  onSelectSource: (id: string) => void
}

/**
 * Composant pour uploader des images sources pour la génération vidéo
 * Supporte le drag & drop et l'upload classique
 */
export function VideoUpload({ selectedSourceId, onSelectSource }: VideoUploadProps) {
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
    let lastUploadedId: string | null = null

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

        const data = await response.json()
        lastUploadedId = data.id
        successCount++
      } catch (error) {
        toast.error(`Erreur: ${file.name} - ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploadée(s)`)
      await refreshVideoSources()
      // Auto-sélectionner la dernière image uploadée
      if (lastUploadedId) {
        onSelectSource(lastUploadedId)
      }
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
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
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
          <Upload className={`w-10 h-10 ${isDragging ? 'text-purple-500' : 'text-gray-400'}`} />
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
        <div className="grid grid-cols-3 gap-2">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => onSelectSource(source.id)}
              className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                selectedSourceId === source.id
                  ? 'border-purple-500 ring-2 ring-purple-500/50'
                  : 'border-transparent hover:border-gray-400'
              }`}
            >
              {/* Image preview */}
              <img
                src={`/api/videos/sources/${source.id}/image`}
                alt={source.originalName}
                className="w-full h-full object-cover"
              />

              {/* Indicateur de sélection */}
              {selectedSourceId === source.id && (
                <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Bouton supprimer au survol */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(source)
                }}
                className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Supprimer"
              >
                <Trash2 className="w-3 h-3" />
              </div>
            </button>
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
