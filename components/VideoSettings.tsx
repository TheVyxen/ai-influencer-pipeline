'use client'

import { useState } from 'react'
import { Play, Loader2, Smartphone, Monitor } from 'lucide-react'
import { Button } from './ui/button'
import toast from 'react-hot-toast'
import { refreshGeneratedVideos } from '@/lib/hooks/use-videos'

interface VideoSettingsProps {
  selectedSourceId: string
  onGenerationStarted?: () => void
}

/**
 * Composant pour configurer et lancer la génération vidéo
 */
export function VideoSettings({ selectedSourceId, onGenerationStarted }: VideoSettingsProps) {
  // Paramètres de génération
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [duration, setDuration] = useState<5 | 6 | 7 | 8>(5)
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

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

      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Format
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setAspectRatio('9:16')}
            disabled={generating}
            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
              aspectRatio === '9:16'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-medium">9:16</span>
          </button>
          <button
            onClick={() => setAspectRatio('16:9')}
            disabled={generating}
            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
              aspectRatio === '16:9'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span className="text-sm font-medium">16:9</span>
          </button>
        </div>
      </div>

      {/* Durée */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Durée
          </label>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {duration}s
          </span>
        </div>
        <div className="relative h-4 flex items-center">
          <div className="absolute left-0 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
          <div
            className="absolute left-0 h-2 bg-blue-600 rounded-lg transition-all"
            style={{ width: `${((duration - 5) / 3) * 100}%` }}
          />
          <input
            type="range"
            min="5"
            max="8"
            step="1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) as 5 | 6 | 7 | 8)}
            disabled={generating}
            className="absolute w-full h-4 bg-transparent rounded-lg appearance-none cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5s</span>
          <span>6s</span>
          <span>7s</span>
          <span>8s</span>
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
        disabled={generating || !selectedSourceId}
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
    </div>
  )
}
