import prisma from '@/lib/prisma'
import { SourceList } from '@/components/SourceList'
import { PhotoValidation } from '@/components/PhotoValidation'
import { GeneratedGallery } from '@/components/GeneratedGallery'
import { StatsBar } from '@/components/StatsBar'

// Force le rendu dynamique (pas de cache statique)
export const dynamic = 'force-dynamic'

/**
 * Dashboard principal - Page d'accueil
 * Layout simplifié : Sources | Photos à valider | Photos générées
 * Workflow : Valider = Décrire + Générer automatiquement
 */
export default async function Home() {
  // Fetch toutes les données côté serveur
  const [sources, pendingPhotos, generatedPhotos, lastGenerated] = await Promise.all([
    prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { photos: true }
        }
      }
    }),
    prisma.sourcePhoto.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        source: {
          select: { username: true }
        }
      }
    }),
    prisma.generatedPhoto.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourcePhoto: {
          select: {
            id: true,
            source: {
              select: { username: true }
            }
          }
        }
      }
    }),
    // Dernière activité (dernière photo générée ou scrapée)
    prisma.generatedPhoto.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ])

  // Transformer les données pour les composants
  const sourcesData = sources.map(s => ({
    id: s.id,
    username: s.username,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    _count: s._count
  }))

  const pendingPhotosData = pendingPhotos.map(p => ({
    id: p.id,
    originalUrl: p.originalUrl,
    localPath: p.localPath,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    instagramPostUrl: p.instagramPostUrl,
    // Champs carrousel
    isCarousel: p.isCarousel,
    carouselId: p.carouselId,
    carouselIndex: p.carouselIndex,
    carouselTotal: p.carouselTotal,
    source: p.source
  }))

  const generatedPhotosData = generatedPhotos.map(p => ({
    id: p.id,
    prompt: p.prompt,
    localPath: p.localPath,
    createdAt: p.createdAt.toISOString(),
    // Champs carrousel
    isCarousel: p.isCarousel,
    carouselId: p.carouselId,
    carouselIndex: p.carouselIndex,
    carouselTotal: p.carouselTotal,
    sourcePhoto: p.sourcePhoto
  }))

  const sourcesForUpload = sources.map(s => ({
    id: s.id,
    username: s.username
  }))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                AI Influencer Pipeline
              </h1>
            </div>
            <a
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Settings</span>
            </a>
          </div>
        </div>
      </header>

      {/* Contenu principal - Layout 3 colonnes */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Barre de statistiques */}
        <StatsBar
          sourcesCount={sources.length}
          pendingCount={pendingPhotos.length}
          generatedCount={generatedPhotos.length}
          lastActivity={lastGenerated?.createdAt?.toISOString() || null}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1 : Sources Instagram */}
          <div>
            <SourceList initialSources={sourcesData} />
          </div>

          {/* Section 2 : Photos à valider (validation = génération auto) */}
          <div>
            <PhotoValidation
              initialPhotos={pendingPhotosData}
              sources={sourcesForUpload}
            />
          </div>

          {/* Section 3 : Photos générées */}
          <div>
            <GeneratedGallery photos={generatedPhotosData} />
          </div>
        </div>
      </div>
    </main>
  )
}
