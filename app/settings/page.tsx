'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Upload,
  Trash2,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  User,
  Key,
  Zap,
  ImageIcon,
  Sparkles
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface ReferencePhoto {
  exists: boolean
  path: string | null
  format: string | null
}

interface ApiStatus {
  google_ai: 'idle' | 'testing' | 'success' | 'error'
  wavespeed: 'idle' | 'testing' | 'success' | 'error'
  apify: 'idle' | 'testing' | 'success' | 'error'
}

/**
 * Page de configuration de l'application
 * - Photo de référence du modèle
 * - Clé API Google AI (description + génération Gemini 3)
 * - Clé API Wavespeed (génération alternative)
 * - Clé API Apify (scraping)
 * - Options de génération d'image
 */
export default function SettingsPage() {
  // États pour les settings
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [referencePhoto, setReferencePhoto] = useState<ReferencePhoto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // États pour la visibilité des clés API
  const [showKeys, setShowKeys] = useState({
    googleAi: false,
    wavespeed: false,
    apify: false
  })

  // États pour les tests d'API
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    google_ai: 'idle',
    wavespeed: 'idle',
    apify: 'idle'
  })

  // Modal de confirmation pour supprimer la photo de référence
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Provider actuel
  const currentProvider = settings.image_provider || 'gemini'

  // Charger les settings au montage
  useEffect(() => {
    loadSettings()
    loadReferencePhoto()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Erreur lors du chargement des paramètres')
    } finally {
      setIsLoading(false)
    }
  }

  const loadReferencePhoto = async () => {
    try {
      const res = await fetch('/api/reference')
      if (res.ok) {
        const data = await res.json()
        setReferencePhoto(data)
      }
    } catch (error) {
      console.error('Error loading reference photo:', error)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!res.ok) throw new Error('Failed to save')

      toast.success('Paramètres sauvegardés avec succès')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/reference', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload')
      }

      const data = await res.json()
      setReferencePhoto({
        exists: true,
        path: data.path,
        format: data.format
      })
      toast.success('Photo de référence uploadée avec succès')
    } catch (error) {
      console.error('Error uploading reference:', error)
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'upload')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteReference = async () => {
    try {
      const res = await fetch('/api/reference', { method: 'DELETE' })

      if (!res.ok) throw new Error('Failed to delete')

      setReferencePhoto({ exists: false, path: null, format: null })
      toast.success('Photo de référence supprimée')
    } catch (error) {
      console.error('Error deleting reference:', error)
      toast.error('Erreur lors de la suppression')
    } finally {
      setShowDeleteModal(false)
    }
  }

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Tester une API
  const testApi = async (api: 'google_ai' | 'wavespeed' | 'apify') => {
    setApiStatus(prev => ({ ...prev, [api]: 'testing' }))

    try {
      const res = await fetch('/api/test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api })
      })

      const data = await res.json()

      if (data.success) {
        setApiStatus(prev => ({ ...prev, [api]: 'success' }))
        toast.success(data.message || 'Connexion réussie')
      } else {
        setApiStatus(prev => ({ ...prev, [api]: 'error' }))
        toast.error(data.error || 'Échec de la connexion')
      }
    } catch {
      setApiStatus(prev => ({ ...prev, [api]: 'error' }))
      toast.error('Erreur lors du test')
    }
  }

  // Composant pour le statut de l'API
  const ApiStatusIndicator = ({ status }: { status: 'idle' | 'testing' | 'success' | 'error' }) => {
    if (status === 'idle') return null
    if (status === 'testing') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />
    return null
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-600" />
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section Photo de référence */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Photo de référence du modèle
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Cette photo sera utilisée comme base pour toutes les générations d&apos;images.
            Elle définit l&apos;identité visuelle de votre modèle IA.
          </p>

          <div className="flex items-start gap-6">
            {/* Aperçu de la photo */}
            <div className="w-40 h-40 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
              {referencePhoto?.exists && referencePhoto.path ? (
                <Image
                  src={`${referencePhoto.path}?t=${Date.now()}`}
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

            {/* Actions */}
            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleUploadReference}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {referencePhoto?.exists ? 'Changer la photo' : 'Uploader une photo'}
                  </>
                )}
              </button>

              {referencePhoto?.exists && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}

              <p className="text-xs text-gray-400">
                Formats acceptés : JPG, PNG. Résolution recommandée : 1024x1024 minimum.
              </p>
            </div>
          </div>
        </section>

        {/* Section Clés API */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Clés API
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Configurez vos clés API pour activer les différentes fonctionnalités.
            Utilisez le bouton &quot;Tester&quot; pour vérifier chaque connexion.
          </p>

          <div className="space-y-6">
            {/* Google AI API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Google AI API Key
                </label>
                <ApiStatusIndicator status={apiStatus.google_ai} />
              </div>
              <p className="text-xs text-gray-500">
                Pour la description (Gemini 3 Pro) et la génération d&apos;images (Gemini 3 Pro Image)
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.googleAi ? 'text' : 'password'}
                    value={settings.google_ai_api_key || ''}
                    onChange={(e) => updateSetting('google_ai_api_key', e.target.value)}
                    placeholder="AIza..."
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, googleAi: !prev.googleAi }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.googleAi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => testApi('google_ai')}
                  disabled={!settings.google_ai_api_key || apiStatus.google_ai === 'testing'}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {apiStatus.google_ai === 'testing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Tester
                </button>
              </div>
            </div>

            {/* Wavespeed API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Wavespeed API Key
                  {currentProvider === 'wavespeed' && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                      Actif
                    </span>
                  )}
                </label>
                <ApiStatusIndicator status={apiStatus.wavespeed} />
              </div>
              <p className="text-xs text-gray-500">
                Alternative à Gemini pour la génération d&apos;images (google/nano-banana-pro/edit)
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.wavespeed ? 'text' : 'password'}
                    value={settings.wavespeed_api_key || ''}
                    onChange={(e) => updateSetting('wavespeed_api_key', e.target.value)}
                    placeholder="wsk_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, wavespeed: !prev.wavespeed }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.wavespeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => testApi('wavespeed')}
                  disabled={!settings.wavespeed_api_key || apiStatus.wavespeed === 'testing'}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {apiStatus.wavespeed === 'testing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Tester
                </button>
              </div>
            </div>

            {/* Apify API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Apify API Key
                </label>
                <ApiStatusIndicator status={apiStatus.apify} />
              </div>
              <p className="text-xs text-gray-500">
                Pour le scraping Instagram
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.apify ? 'text' : 'password'}
                    value={settings.apify_api_key || ''}
                    onChange={(e) => updateSetting('apify_api_key', e.target.value)}
                    placeholder="apify_api_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, apify: !prev.apify }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.apify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => testApi('apify')}
                  disabled={!settings.apify_api_key || apiStatus.apify === 'testing'}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {apiStatus.apify === 'testing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Tester
                </button>
              </div>
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* Section Configuration du scraping */}
          <h3 className="text-md font-medium text-gray-900 mb-4">Configuration du scraping</h3>
          <div className="space-y-4">
            {/* Posts par scrape */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posts par scrape
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Nombre de posts à récupérer par compte Instagram (1-50)
              </p>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.posts_per_scrape || '10'}
                onChange={(e) => updateSetting('posts_per_scrape', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* Section Configuration de génération d'images */}
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-gray-600" />
            <h3 className="text-md font-medium text-gray-900">Configuration de génération</h3>
          </div>

          {/* Provider de génération */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider de génération
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Choisissez le service utilisé pour générer les images. Utilisez Wavespeed en cas de surcharge Gemini.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Option Gemini */}
              <button
                onClick={() => updateSetting('image_provider', 'gemini')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  currentProvider === 'gemini'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className={`w-4 h-4 ${currentProvider === 'gemini' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${currentProvider === 'gemini' ? 'text-blue-900' : 'text-gray-700'}`}>
                    Gemini 3 Pro Image
                  </span>
                  {currentProvider === 'gemini' && (
                    <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Recommandé - Retry auto (3x)
                </p>
              </button>

              {/* Option Wavespeed */}
              <button
                onClick={() => updateSetting('image_provider', 'wavespeed')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  currentProvider === 'wavespeed'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 ${currentProvider === 'wavespeed' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${currentProvider === 'wavespeed' ? 'text-purple-900' : 'text-gray-700'}`}>
                    Wavespeed
                  </span>
                  {currentProvider === 'wavespeed' && (
                    <CheckCircle className="w-4 h-4 text-purple-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Alternative - Nano Banana Pro
                </p>
              </button>
            </div>
          </div>

          {/* Options Gemini uniquement */}
          {currentProvider === 'gemini' && (
            <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
              {/* Format d'image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Format d&apos;image
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Ratio d&apos;aspect des images générées
                </p>
                <select
                  value={settings.image_aspect_ratio || '9:16'}
                  onChange={(e) => updateSetting('image_aspect_ratio', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="9:16">9:16 (Portrait - Instagram Stories)</option>
                  <option value="1:1">1:1 (Carré - Instagram Feed)</option>
                  <option value="16:9">16:9 (Paysage)</option>
                </select>
              </div>

              {/* Qualité d'image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qualité d&apos;image
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Résolution des images générées
                </p>
                <select
                  value={settings.image_size || '2K'}
                  onChange={(e) => updateSetting('image_size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="1K">1K (Rapide)</option>
                  <option value="2K">2K (Recommandé)</option>
                  <option value="4K">4K (Haute qualité)</option>
                </select>
              </div>
            </div>
          )}

          {/* Info Wavespeed */}
          {currentProvider === 'wavespeed' && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700">
                <strong>Modèle utilisé :</strong> google/nano-banana-pro/edit
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Les options de format et qualité ne sont pas disponibles avec Wavespeed.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Sauvegarder les paramètres
                </>
              )}
            </button>
          </div>
        </section>

        {/* Note informative */}
        <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">
            Note importante
          </h3>
          <p className="text-sm text-yellow-700">
            Les clés API stockées dans Settings sont utilisées côté serveur uniquement.
            Pour une sécurité optimale en production, utilisez plutôt des variables
            d&apos;environnement (.env) sur votre serveur.
          </p>
        </section>
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteReference}
        title="Supprimer la photo de référence ?"
        message="Cette action supprimera définitivement la photo de référence utilisée pour les générations."
        confirmText="Supprimer"
        variant="danger"
      />
    </main>
  )
}
