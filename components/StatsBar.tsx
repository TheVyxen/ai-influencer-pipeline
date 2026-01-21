'use client'

import { Users, Clock, Activity, Sparkles } from 'lucide-react'
import { useStats } from '@/lib/hooks/use-photos'

interface StatsBarProps {
  sourcesCount: number
  pendingCount: number
  generatedCount: number
  lastActivity: string | null
}

/**
 * Barre de statistiques en haut du dashboard
 * Workflow simplifié : Sources → En attente → Générées
 * Utilise SWR pour le rafraîchissement automatique
 */
export function StatsBar({
  sourcesCount: initialSourcesCount,
  pendingCount: initialPendingCount,
  generatedCount: initialGeneratedCount,
  lastActivity: initialLastActivity,
}: StatsBarProps) {
  // Utiliser SWR pour les stats avec les données initiales comme fallback
  const { stats: swrStats } = useStats()

  // Utiliser les données SWR si disponibles, sinon les données initiales
  const sourcesCount = swrStats?.sourcesCount ?? initialSourcesCount
  const pendingCount = swrStats?.pendingCount ?? initialPendingCount
  const generatedCount = swrStats?.generatedCount ?? initialGeneratedCount
  const lastActivity = swrStats?.lastActivity ?? initialLastActivity
  const stats = [
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => {
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
