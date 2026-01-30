'use client'

import { useState } from 'react'
import { Link as LinkIcon, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import toast from 'react-hot-toast'

interface ImportPostProps {
  onImported?: () => void
}

/**
 * Composant pour importer un post Instagram par URL
 */
export function ImportPost({ onImported }: ImportPostProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      toast.error('Entrez une URL de post Instagram')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Import en cours...')

    try {
      const response = await fetch('/api/scrape/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'import')
      }

      if (data.photosImported > 0) {
        toast.success(
          `${data.photosImported} photo(s) importée(s)${data.photosSkipped > 0 ? ` (${data.photosSkipped} doublon(s))` : ''}`,
          { id: toastId }
        )
        setUrl('')
        onImported?.()
      } else if (data.photosSkipped > 0) {
        toast.error('Photos déjà importées', { id: toastId })
      } else {
        toast.error('Aucune photo trouvée', { id: toastId })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'import', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/p/..."
          disabled={loading}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
        />
      </div>
      <Button type="submit" disabled={loading || !url.trim()}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          'Importer'
        )}
      </Button>
    </form>
  )
}
