'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Upload,
  Trash2,
  Save,
  User,
  Loader2,
  Settings,
  ImageIcon,
  Sparkles,
  Zap,
  CheckCircle,
  Clock,
  Bot,
  RefreshCw,
  Instagram,
  Link,
  Unlink,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface Influencer {
  id: string
  name: string
  handle: string
  isActive: boolean
  avatarData: string | null
  referencePhotoData: string | null
  agentEnabled: boolean
  agentInterval: number
  lastAgentRun: string | null
}

interface InfluencerSettings {
  imageProvider: string
  imageAspectRatio: string
  imageSize: string
  postsPerScrape: number
  autoScrapeEnabled: boolean
  autoScrapeInterval: number
  lastAutoScrape: string | null
  captionTone: string
  captionLength: string
  captionEmojis: boolean
  hashtagCount: number
  validationThreshold: number
  postsPerDay: number
}

interface InstagramAccount {
  id: string
  instagramUsername: string
  instagramAccountType: string
  accessTokenExpiresAt: string
  isConnected: boolean
  errorMessage: string | null
}

/**
 * Page de configuration détaillée d'une influenceuse
 */
export default function InfluencerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const influencerId = params.id as string

  // États
  const [influencer, setInfluencer] = useState<Influencer | null>(null)
  const [settings, setSettings] = useState<InfluencerSettings | null>(null)
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingReference, setIsUploadingReference] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showDeleteReferenceModal, setShowDeleteReferenceModal] = useState(false)
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false)
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false)

  // Refs pour les inputs file
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Charger les données
  useEffect(() => {
    loadData()

    // Vérifier si on revient du callback Instagram
    const urlParams = new URLSearchParams(window.location.search)
    const instagramStatus = urlParams.get('instagram')
    if (instagramStatus === 'connected') {
      toast.success('Compte Instagram connecté avec succès')
      // Nettoyer l'URL
      window.history.replaceState({}, '', `/influencers/${influencerId}`)
    } else if (instagramStatus === 'error') {
      const errorMsg = urlParams.get('message')
      toast.error(errorMsg || 'Erreur de connexion Instagram')
      window.history.replaceState({}, '', `/influencers/${influencerId}`)
    }
  }, [influencerId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [infRes, settingsRes] = await Promise.all([
        fetch(`/api/influencers/${influencerId}`),
        fetch(`/api/influencers/${influencerId}/settings`)
      ])

      if (!infRes.ok) {
        toast.error('Influenceuse non trouvée')
        router.push('/influencers')
        return
      }

      const infData = await infRes.json()
      const settingsData = await settingsRes.json()

      setInfluencer(infData)
      setSettings(settingsData)

      // Charger le compte Instagram s'il existe
      if (infData.instagramAccount) {
        setInstagramAccount(infData.instagramAccount)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setIsLoading(false)
    }
  }

  // Sauvegarder les infos de l'influenceuse
  const handleSaveInfluencer = async () => {
    if (!influencer) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/influencers/${influencerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: influencer.name,
          handle: influencer.handle,
          isActive: influencer.isActive,
          agentEnabled: influencer.agentEnabled,
          agentInterval: influencer.agentInterval
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      toast.success('Informations sauvegardées')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Sauvegarder les settings
  const handleSaveSettings = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/influencers/${influencerId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }

      toast.success('Paramètres sauvegardés')
    } catch {
      toast.error('Erreur lors de la sauvegarde des paramètres')
    } finally {
      setIsSaving(false)
    }
  }

  // Upload photo de référence
  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingReference(true)
    try {
      // Convertir en base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string

        const res = await fetch(`/api/influencers/${influencerId}/reference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64 })
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to upload')
        }

        setInfluencer(prev => prev ? { ...prev, referencePhotoData: base64 } : null)
        toast.success('Photo de référence mise à jour')
        setIsUploadingReference(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'upload')
      setIsUploadingReference(false)
    } finally {
      if (referenceInputRef.current) {
        referenceInputRef.current.value = ''
      }
    }
  }

  // Supprimer photo de référence
  const handleDeleteReference = async () => {
    try {
      const res = await fetch(`/api/influencers/${influencerId}/reference`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      setInfluencer(prev => prev ? { ...prev, referencePhotoData: null } : null)
      toast.success('Photo de référence supprimée')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setShowDeleteReferenceModal(false)
    }
  }

  // Connecter Instagram
  const handleConnectInstagram = async () => {
    setIsConnectingInstagram(true)
    try {
      // Rediriger vers l'endpoint OAuth
      window.location.href = `/api/instagram/auth?influencerId=${influencerId}`
    } catch (error) {
      toast.error('Erreur lors de la connexion Instagram')
      setIsConnectingInstagram(false)
    }
  }

  // Déconnecter Instagram
  const handleDisconnectInstagram = async () => {
    setIsDisconnectingInstagram(true)
    try {
      const res = await fetch('/api/instagram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId })
      })

      if (!res.ok) {
        throw new Error('Failed to disconnect')
      }

      setInstagramAccount(null)
      toast.success('Compte Instagram déconnecté')
    } catch (error) {
      toast.error('Erreur lors de la déconnexion')
    } finally {
      setIsDisconnectingInstagram(false)
    }
  }

  // Upload avatar
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string

        const res = await fetch(`/api/influencers/${influencerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarData: base64 })
        })

        if (!res.ok) {
          throw new Error('Failed to upload avatar')
        }

        setInfluencer(prev => prev ? { ...prev, avatarData: base64 } : null)
        toast.success('Avatar mis à jour')
        setIsUploadingAvatar(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Erreur lors de l\'upload de l\'avatar')
      setIsUploadingAvatar(false)
    } finally {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </main>
    )
  }

  if (!influencer || !settings) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/influencers')}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {influencer.avatarData ? (
                <img
                  src={influencer.avatarData}
                  alt={influencer.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {influencer.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {influencer.handle}
                </p>
              </div>
            </div>
            <a
              href="/"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section Informations de base */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Informations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Avatar
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  {influencer.avatarData ? (
                    <img
                      src={influencer.avatarData}
                      alt={influencer.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleUploadAvatar}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Changer
                  </Button>
                </div>
              </div>
            </div>

            {/* Nom et Handle */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={influencer.name}
                  onChange={e => setInfluencer({ ...influencer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Handle
                </label>
                <input
                  type="text"
                  value={influencer.handle}
                  onChange={e => setInfluencer({ ...influencer, handle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Status Active */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Statut
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Une influenceuse inactive n&apos;apparaîtra pas dans le sélecteur
                </p>
              </div>
              <button
                onClick={() => setInfluencer({ ...influencer, isActive: !influencer.isActive })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  influencer.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    influencer.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-6">
            <Button onClick={handleSaveInfluencer} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </section>

        {/* Section Photo de référence */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Photo de référence
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cette photo sera utilisée comme base pour toutes les générations d&apos;images de cette influenceuse.
          </p>

          <div className="flex items-start gap-6">
            <div className="w-40 h-40 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative">
              {influencer.referencePhotoData ? (
                <Image
                  src={influencer.referencePhotoData}
                  alt="Photo de référence"
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <input
                ref={referenceInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleUploadReference}
                className="hidden"
              />

              <Button
                onClick={() => referenceInputRef.current?.click()}
                disabled={isUploadingReference}
                className="w-full"
              >
                {isUploadingReference ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {influencer.referencePhotoData ? 'Changer la photo' : 'Uploader une photo'}
                  </>
                )}
              </Button>

              {influencer.referencePhotoData && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteReferenceModal(true)}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Formats acceptés : JPG, PNG, WebP. Résolution recommandée : 1024x1024 minimum.
              </p>
            </div>
          </div>
        </section>

        {/* Section Génération d'images */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Génération d&apos;images
            </h2>
          </div>

          {/* Provider */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider de génération
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSettings({ ...settings, imageProvider: 'gemini' })}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  settings.imageProvider === 'gemini'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className={`w-4 h-4 ${settings.imageProvider === 'gemini' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${settings.imageProvider === 'gemini' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    Gemini 3 Pro Image
                  </span>
                  {settings.imageProvider === 'gemini' && (
                    <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommandé</p>
              </button>

              <button
                onClick={() => setSettings({ ...settings, imageProvider: 'wavespeed' })}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  settings.imageProvider === 'wavespeed'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 ${settings.imageProvider === 'wavespeed' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${settings.imageProvider === 'wavespeed' ? 'text-purple-900 dark:text-purple-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    Wavespeed
                  </span>
                  {settings.imageProvider === 'wavespeed' && (
                    <CheckCircle className="w-4 h-4 text-purple-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Alternative</p>
              </button>
            </div>
          </div>

          {/* Options Format et Qualité */}
          {settings.imageProvider === 'gemini' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Format
                </label>
                <select
                  value={settings.imageAspectRatio}
                  onChange={e => setSettings({ ...settings, imageAspectRatio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="1:1">1:1 (Carré)</option>
                  <option value="16:9">16:9 (Paysage)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Qualité
                </label>
                <select
                  value={settings.imageSize}
                  onChange={e => setSettings({ ...settings, imageSize: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="1K">1K (Rapide)</option>
                  <option value="2K">2K (Recommandé)</option>
                  <option value="4K">4K (Haute qualité)</option>
                </select>
              </div>
            </div>
          )}

          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sauvegarder les paramètres
          </Button>
        </section>

        {/* Section Scraping */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Scraping
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Posts par scrape
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.postsPerScrape}
                onChange={e => setSettings({ ...settings, postsPerScrape: parseInt(e.target.value) || 10 })}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Scraping automatique
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Scraper automatiquement les sources à intervalle régulier
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoScrapeEnabled: !settings.autoScrapeEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoScrapeEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoScrapeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings.autoScrapeEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Intervalle
                  </label>
                  <select
                    value={settings.autoScrapeInterval}
                    onChange={e => setSettings({ ...settings, autoScrapeInterval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="3">Toutes les 3 heures</option>
                    <option value="6">Toutes les 6 heures</option>
                    <option value="12">Toutes les 12 heures</option>
                    <option value="24">Toutes les 24 heures</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </section>

        {/* Section Compte Instagram */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Instagram className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Compte Instagram
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Connectez un compte Instagram Business ou Creator pour publier automatiquement du contenu.
          </p>

          {instagramAccount ? (
            // Compte connecté
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      @{instagramAccount.instagramUsername}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {instagramAccount.instagramAccountType === 'BUSINESS' ? 'Compte Business' : 'Compte Creator'}
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>

              {/* Expiration du token */}
              {instagramAccount.accessTokenExpiresAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Token expire le {new Date(instagramAccount.accessTokenExpiresAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  {new Date(instagramAccount.accessTokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      Expire bientôt
                    </span>
                  )}
                </div>
              )}

              {/* Erreur éventuelle */}
              {instagramAccount.errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {instagramAccount.errorMessage}
                </div>
              )}

              <Button
                variant="danger"
                onClick={handleDisconnectInstagram}
                disabled={isDisconnectingInstagram}
              >
                {isDisconnectingInstagram ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                Déconnecter
              </Button>
            </div>
          ) : (
            // Pas de compte connecté
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Aucun compte Instagram connecté. Connectez un compte pour publier automatiquement.
                </p>
              </div>

              <Button
                onClick={handleConnectInstagram}
                disabled={isConnectingInstagram}
                className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500"
              >
                {isConnectingInstagram ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Link className="w-4 h-4 mr-2" />
                )}
                Connecter Instagram
              </Button>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vous serez redirigé vers Meta pour autoriser l&apos;accès.
                Un compte Business ou Creator est requis.
              </p>
            </div>
          )}
        </section>

        {/* Section Agent (Phase 2 preview) */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 opacity-60">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Agent autonome
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
              Phase 2
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            L&apos;agent autonome permettra d&apos;exécuter automatiquement le pipeline complet :
            scrape, validation IA, génération, captions et publication.
          </p>
        </section>
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={showDeleteReferenceModal}
        onClose={() => setShowDeleteReferenceModal(false)}
        onConfirm={handleDeleteReference}
        title="Supprimer la photo de référence"
        message="Êtes-vous sûr de vouloir supprimer la photo de référence ? Les générations futures nécessiteront une nouvelle photo."
        confirmText="Supprimer"
        variant="danger"
      />
    </main>
  )
}
