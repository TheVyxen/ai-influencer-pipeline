'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VideoUpload } from '@/components/VideoUpload'
import { VideoSettings } from '@/components/VideoSettings'
import { VideoGallery } from '@/components/VideoGallery'
import { useVideoSources } from '@/lib/hooks/use-videos'
import { ArrowLeft, Video, Settings } from 'lucide-react'

/**
 * Page de génération vidéo
 * Workflow : Upload image → Configurer → Générer → Visualiser
 */
export default function VideosPage() {
  const { sources } = useVideoSources()
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')

  // Auto-sélectionner la première source si aucune n'est sélectionnée
  useEffect(() => {
    if (sources.length > 0 && !selectedSourceId) {
      setSelectedSourceId(sources[0].id)
    } else if (sources.length === 0) {
      setSelectedSourceId('')
    }
  }, [sources, selectedSourceId])
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo et navigation */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Génération Vidéo
              </h1>
            </div>
          </div>

          {/* Lien Settings */}
          <Link
            href="/settings"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Settings</span>
          </Link>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
            <div>
              <h2 className="font-medium text-purple-900 dark:text-purple-100">
                Génération vidéo avec Veo 3.1
              </h2>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Uploadez une image, configurez les paramètres et générez une vidéo animée.
                Les vidéos sont stockées sur Google Cloud Storage.
              </p>
            </div>
          </div>
        </div>

        {/* Layout 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche : Upload + Settings fusionnés */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-6">
              <VideoUpload
                selectedSourceId={selectedSourceId}
                onSelectSource={setSelectedSourceId}
              />
              <VideoSettings selectedSourceId={selectedSourceId} />
            </div>
          </div>

          {/* Colonne droite : Galerie */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <VideoGallery />
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by <span className="font-medium">Google Veo 3.1</span> via Vertex AI
          </p>
          <p className="mt-1">
            Les vidéos sont générées de manière asynchrone et peuvent prendre 30 secondes à 2 minutes.
          </p>
        </div>
      </main>
    </div>
  )
}
