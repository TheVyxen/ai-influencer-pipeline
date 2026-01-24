'use client'

import { useEffect, useCallback } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from './ui/button'

interface VideoPlayerProps {
  isOpen: boolean
  onClose: () => void
  videoUrl: string
  title?: string
  onDownload?: () => void
}

/**
 * Modal de lecture vidéo plein écran
 */
export function VideoPlayer({ isOpen, onClose, videoUrl, title, onDownload }: VideoPlayerProps) {
  // Fermer avec la touche Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Empêcher le scroll du body
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
      />

      {/* Contenu */}
      <div className="relative w-full max-w-4xl mx-4 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium truncate max-w-md">
            {title || 'Vidéo'}
          </h3>
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button
                variant="secondary"
                onClick={onDownload}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white transition-colors"
              title="Fermer (Escape)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Player */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full max-h-[70vh] object-contain"
          >
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>

        {/* Instructions */}
        <p className="text-center text-white/50 text-sm mt-4">
          Appuyez sur Escape ou cliquez à l&apos;extérieur pour fermer
        </p>
      </div>
    </div>
  )
}
