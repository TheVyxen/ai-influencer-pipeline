'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Image as ImageIcon, Hash, ArrowLeft, Plus, Trash2, Edit2, Send, X, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useInfluencer } from '@/lib/hooks/use-influencer-context'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface ScheduledPost {
  id: string
  imageData: string
  caption: string
  hashtags: string[]
  isCarousel: boolean
  carouselImages: string[]
  scheduledFor: string
  status: 'scheduled' | 'publishing' | 'published' | 'failed'
  publishedAt?: string | null
  instagramPostId?: string | null
  instagramUrl?: string | null
  errorMessage?: string | null
  influencer?: {
    id: string
    name: string
    handle: string
  }
  generatedPhoto?: {
    id: string
    prompt: string
  } | null
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  posts: ScheduledPost[]
}

export default function CalendarPage() {
  const { selectedInfluencerId, selectedInfluencer } = useInfluencer()
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // États pour les actions
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // États pour le formulaire de création/édition
  const [formData, setFormData] = useState({
    caption: '',
    hashtags: '',
    scheduledFor: '',
    imageData: ''
  })

  // Charger les posts programmés
  const fetchScheduledPosts = useCallback(async () => {
    if (!selectedInfluencerId) {
      setScheduledPosts([])
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/scheduled-posts?influencerId=${selectedInfluencerId}`)
      if (response.ok) {
        const data = await response.json()
        setScheduledPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Erreur chargement posts programmés:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedInfluencerId])

  useEffect(() => {
    fetchScheduledPosts()
  }, [fetchScheduledPosts])

  // Générer le calendrier pour le mois actuel
  const generateCalendar = (): CalendarDay[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const calendar: CalendarDay[] = []
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))

    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const postsForDay = scheduledPosts.filter(post => {
        const postDate = new Date(post.scheduledFor).toISOString().split('T')[0]
        return postDate === dateStr
      })

      calendar.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        posts: postsForDay
      })

      current.setDate(current.getDate() + 1)
    }

    return calendar
  }

  const calendar = generateCalendar()

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newDate
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500'
      case 'publishing': return 'bg-yellow-500'
      case 'published': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Programmé'
      case 'publishing': return 'Publication...'
      case 'published': return 'Publié'
      case 'failed': return 'Échec'
      default: return status
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Publier maintenant
  const handlePublishNow = async () => {
    if (!selectedPost) return

    setIsPublishing(true)
    try {
      const res = await fetch(`/api/scheduled-posts/${selectedPost.id}/publish`, {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Échec de la publication')
      }

      toast.success('Post publié avec succès !')
      setSelectedPost(null)
      await fetchScheduledPosts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la publication')
    } finally {
      setIsPublishing(false)
    }
  }

  // Supprimer un post
  const handleDelete = async () => {
    if (!selectedPost) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/scheduled-posts?id=${selectedPost.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Échec de la suppression')
      }

      toast.success('Post supprimé')
      setSelectedPost(null)
      setShowDeleteModal(false)
      await fetchScheduledPosts()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
    }
  }

  // Sauvegarder les modifications
  const handleSaveEdit = async () => {
    if (!selectedPost) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPost.id,
          caption: formData.caption,
          hashtags: formData.hashtags.split(' ').filter(h => h.startsWith('#')),
          scheduledFor: formData.scheduledFor
        })
      })

      if (!res.ok) {
        throw new Error('Échec de la sauvegarde')
      }

      toast.success('Post mis à jour')
      setIsEditing(false)
      setSelectedPost(null)
      await fetchScheduledPosts()
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Créer un nouveau post
  const handleCreate = async () => {
    if (!selectedInfluencerId) {
      toast.error('Sélectionnez une influenceuse')
      return
    }

    if (!formData.imageData || !formData.caption || !formData.scheduledFor) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: selectedInfluencerId,
          imageData: formData.imageData,
          caption: formData.caption,
          hashtags: formData.hashtags.split(' ').filter(h => h.startsWith('#')),
          scheduledFor: formData.scheduledFor
        })
      })

      if (!res.ok) {
        throw new Error('Échec de la création')
      }

      toast.success('Post programmé')
      setShowCreateModal(false)
      setFormData({ caption: '', hashtags: '', scheduledFor: '', imageData: '' })
      await fetchScheduledPosts()
    } catch (error) {
      toast.error('Erreur lors de la création')
    } finally {
      setIsSaving(false)
    }
  }

  // Gérer l'upload d'image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, imageData: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  // Ouvrir le mode édition
  const startEditing = () => {
    if (!selectedPost) return
    setFormData({
      caption: selectedPost.caption,
      hashtags: selectedPost.hashtags.join(' '),
      scheduledFor: new Date(selectedPost.scheduledFor).toISOString().slice(0, 16),
      imageData: selectedPost.imageData
    })
    setIsEditing(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Chargement du calendrier...</p>
        </div>
      </div>
    )
  }

  if (!selectedInfluencerId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Sélectionnez une influenceuse pour voir son calendrier</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Calendrier de {selectedInfluencer?.name}
                </h1>
              </div>
            </div>
            <Button onClick={() => {
              setFormData({ caption: '', hashtags: '', scheduledFor: '', imageData: '' })
              setShowCreateModal(true)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Programmer un post
            </Button>
          </div>

          {/* Navigation mois */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-6 py-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              ←
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              →
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Programmés</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {scheduledPosts.filter(p => p.status === 'scheduled').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Publiés</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {scheduledPosts.filter(p => p.status === 'published').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Échecs</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {scheduledPosts.filter(p => p.status === 'failed').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Ce mois</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {scheduledPosts.filter(p => {
                const postMonth = new Date(p.scheduledFor).getMonth()
                return postMonth === currentDate.getMonth()
              }).length}
            </p>
          </div>
        </div>

        {/* Calendrier */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          {/* Header jours */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-t-xl overflow-hidden">
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
              <div key={day} className="bg-gray-100 dark:bg-gray-800 px-2 py-3 text-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                  {day}
                </span>
              </div>
            ))}
          </div>

          {/* Grille calendrier */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
            {calendar.map((day, index) => (
              <div
                key={index}
                className={`bg-white dark:bg-gray-900 min-h-[120px] p-2 relative ${
                  !day.isCurrentMonth ? 'opacity-50' : ''
                }`}
              >
                {/* Numéro du jour */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${
                    day.date.toDateString() === new Date().toDateString()
                      ? 'bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {day.date.getDate()}
                  </span>
                  {day.posts.length > 0 && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                      {day.posts.length}
                    </span>
                  )}
                </div>

                {/* Posts du jour */}
                <div className="space-y-1">
                  {day.posts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(post.status)}`}></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                          {formatTime(post.scheduledFor)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {day.posts.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                      +{day.posts.length - 3} autres...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal détail/édition post */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {isEditing ? 'Modifier le post' : 'Détail du post'}
                </h3>
                <button
                  onClick={() => {
                    setSelectedPost(null)
                    setIsEditing(false)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Image */}
              {selectedPost.imageData && (
                <div className="w-full aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={selectedPost.imageData}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Status et timing */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedPost.status)}`}></div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {getStatusLabel(selectedPost.status)}
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={formData.scheduledFor}
                    onChange={e => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(selectedPost.scheduledFor).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>

              {/* Caption */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-1">
                  <ImageIcon className="w-4 h-4" />
                  Caption
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.caption}
                    onChange={e => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedPost.caption}
                  </p>
                )}
              </div>

              {/* Hashtags */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-1">
                  <Hash className="w-4 h-4" />
                  Hashtags
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.hashtags}
                    onChange={e => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                    placeholder="#hashtag1 #hashtag2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedPost.hashtags.join(' ')}
                  </p>
                )}
              </div>

              {/* Error message si échec */}
              {selectedPost.status === 'failed' && selectedPost.errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {selectedPost.errorMessage}
                </div>
              )}

              {/* Lien Instagram si publié */}
              {selectedPost.status === 'published' && selectedPost.instagramUrl && (
                <a
                  href={selectedPost.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-purple-600 hover:text-purple-700 text-sm underline"
                >
                  Voir sur Instagram
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between">
              <div className="flex gap-2">
                {selectedPost.status === 'scheduled' && !isEditing && (
                  <>
                    <Button
                      onClick={handlePublishNow}
                      disabled={isPublishing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isPublishing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Publier maintenant
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={startEditing}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                  </>
                )}
                {isEditing && (
                  <>
                    <Button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Sauvegarder
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditing(false)}
                    >
                      Annuler
                    </Button>
                  </>
                )}
              </div>
              {selectedPost.status === 'scheduled' && !isEditing && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal création post */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Programmer un post
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* Upload image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image *
                </label>
                {formData.imageData ? (
                  <div className="relative w-full aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={formData.imageData}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, imageData: '' }))}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="block w-full aspect-video max-w-[200px] mx-auto border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm">Cliquez pour upload</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Date/heure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date et heure de publication *
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledFor}
                  onChange={e => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Caption *
                </label>
                <textarea
                  value={formData.caption}
                  onChange={e => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                  rows={4}
                  placeholder="Votre texte ici..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={formData.hashtags}
                  onChange={e => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="#hashtag1 #hashtag2"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Programmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Supprimer ce post ?"
        message="Cette action est irréversible. Le post sera définitivement supprimé."
        confirmText={isDeleting ? 'Suppression...' : 'Supprimer'}
        variant="danger"
      />
    </div>
  )
}
