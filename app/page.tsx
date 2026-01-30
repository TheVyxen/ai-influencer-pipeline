import { SourceList } from '@/components/SourceList'
import { PhotoValidation } from '@/components/PhotoValidation'
import { GeneratedGallery } from '@/components/GeneratedGallery'
import { StatsBar } from '@/components/StatsBar'
import { DashboardHeader } from '@/components/DashboardHeader'

/**
 * Dashboard principal - Page d'accueil
 * Layout simplifié : Sources | Photos à valider | Photos générées
 * Les composants gèrent leur propre data fetching via SWR + contexte influenceur
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header avec sélecteur d'influenceuse */}
      <DashboardHeader />

      {/* Contenu principal - Layout 3 colonnes */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Barre de statistiques */}
        <StatsBar />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1 : Sources Instagram */}
          <div>
            <SourceList />
          </div>

          {/* Section 2 : Photos à valider (validation = génération auto) */}
          <div>
            <PhotoValidation />
          </div>

          {/* Section 3 : Photos générées */}
          <div>
            <GeneratedGallery />
          </div>
        </div>
      </div>
    </main>
  )
}
