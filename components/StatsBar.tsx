'use client'

import { Users, Clock, Activity, Sparkles } from 'lucide-react'
import { useStats } from '@/lib/hooks/use-photos'
import { useInfluencer } from '@/lib/hooks/use-influencer-context'
import { Skeleton } from './ui/Skeleton'

/**
 * Barre de statistiques en haut du dashboard
 * Workflow simplifié : Sources → En attente → Générées
 * Utilise le contexte influenceur et SWR pour les données
 */
export function StatsBar() {
  const { selectedInfluencerId } = useInfluencer()
  const { stats, isLoading } = useStats(selectedInfluencerId)

  // Valeurs par défaut si pas encore chargé
  const sourcesCount = stats?.sourcesCount ?? 0
  const pendingCount = stats?.pendingCount ?? 0
  const generatedCount = stats?.generatedCount ?? 0
  const lastActivity = stats?.lastActivity ?? null
  const statsItems = [
    {
      label: 'Sources',
      value: sourcesCount,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
    },
    {
      label: 'En attente',
      value: pendingCount,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
    },
    {
      label: 'Générées',
      value: generatedCount,
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
    },
  ]

  // Formater la date de dernière activité
  const formatLastActivity = (date: string | null) => {
    if (!date) return 'Aucune'

    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }).format(d)
  }

  // Pendant le chargement ou sans influenceur
  if (!selectedInfluencerId || isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statsItems.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              </div>
            </div>
          </div>
        )
      })}

      {/* Dernière activité */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Dernière activité</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatLastActivity(lastActivity)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
