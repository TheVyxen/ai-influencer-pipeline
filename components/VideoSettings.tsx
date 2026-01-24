'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import toast from 'react-hot-toast'
import { useVideoSources, refreshGeneratedVideos, VideoSource } from '@/lib/hooks/use-videos'

interface VideoSettingsProps {
  onGenerationStarted?: () => void
}

/**
 * Composant pour configurer et lancer la génération vidéo
 */
export function VideoSettings({ onGenerationStarted }: VideoSettingsProps) {
  const { sources } = useVideoSources()

  // Paramètres de génération
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [duration, setDuration] = useState<5 | 6 | 7 | 8>(5)
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  // Référence pour tracker le nombre précédent de sources
  const prevSourcesLength = useRef(sources.length)

  // Auto-sélection de la dernière image uploadée
  useEffect(() => {
    if (sources.length > prevSourcesLength.current) {
      // Une nouvelle source a été ajoutée, la sélectionner automatiquement
      setSelectedSourceId(sources[0].id)
    } else if (sources.length > 0 && !selectedSourceId) {
      // Aucune source sélectionnée, sélectionner la première
      setSelectedSourceId(sources[0].id)
    } else if (sources.length === 0) {
      // Plus de sources, reset la sélection
      setSelectedSourceId('')
    }
    prevSourcesLength.current = sources.length
  }, [sources, selectedSourceId])

  // Lancer la génération
  const handleGenerate = async () => {
    if (!selectedSourceId) {
      toast.error('Sélectionnez une image source')
      return
    }

    setGenerating(true)
    const toastId = toast.loading('Lancement de la génération...')

    try {
      const response = await fetch(`/api/videos/${selectedSourceId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || undefined,
          aspectRatio,
          duration,
          resolution,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur de génération')
      }

      toast.success('Génération lancée ! La vidéo apparaîtra bientôt.', { id: toastId })

      // Reset le formulaire
      setPrompt('')

      // Rafraîchir la liste des vidéos
      await refreshGeneratedVideos()

      // Callback optionnel
      onGenerationStarted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de génération', { id: toastId })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
        Paramètres de génération
      </h3>

      {/* Sélection de l'image source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Image source
        </label>
        <select
          value={selectedSourceId}
          onChange={(e) => setSelectedSourceId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={generating}
        >
          <option value="">Sélectionnez une image...</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.originalName}
            </option>
          ))}
        </select>
      </div>

      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Format
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setAspectRatio('9:16')}
            disabled={generating}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              aspectRatio === '9:16'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            9:16 Portrait
          </button>
          <button
            onClick={() => setAspectRatio('16:9')}
            disabled={generating}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              aspectRatio === '16:9'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            16:9 Paysage
          </button>
        </div>
      </div>

      {/* Durée */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Durée
        </label>
        <div className="flex gap-2">
          {([5, 6, 7, 8] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              disabled={generating}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                duration === d
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* Qualité */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Qualité
        </label>
        <div className="flex gap-2">
          {(['720p', '1080p', '4k'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResolution(r)}
              disabled={generating}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                resolution === r
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt optionnel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Prompt (optionnel)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décrivez le mouvement souhaité..."
          rows={3}
          disabled={generating}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Ex: &quot;Subtle hair movement in the wind, soft smile&quot;
        </p>
      </div>

      {/* Bouton de génération */}
      <Button
        onClick={handleGenerate}
        disabled={generating || !selectedSourceId || sources.length === 0}
        className="w-full flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Générer la vidéo
          </>
        )}
      </Button>

      {sources.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Uploadez d&apos;abord une image source
        </p>
      )}
    </div>
  )
}
