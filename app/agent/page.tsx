'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useInfluencer } from '@/lib/hooks/use-influencer-context'
import { PipelineRunCard } from '@/components/PipelineRunCard'
import { Button } from '@/components/ui/button'
import {
  Play,
  RefreshCw,
  Filter,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  AlertTriangle,
  Bell,
  DollarSign,
  TrendingUp,
  Image,
  Calendar,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PipelineRun {
  id: string
  status: string
  trigger: string
  currentStep?: string | null
  photosScraped: number
  photosValidated: number
  photosGenerated: number
  postsScheduled: number
  errorMessage?: string | null
  errorStep?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  influencer?: {
    id: string
    name: string
    handle: string
    avatarData?: string | null
  }
  steps: {
    id: string
    step: string
    status: string
    errorMessage?: string | null
    startedAt?: string | null
    completedAt?: string | null
  }[]
}

interface JobStats {
  pending: number
  processing: number
  completed: number
  failed: number
}

interface Alert {
  id: string
  type: string
  category: string
  title: string
  message: string
  createdAt: string
  influencer?: { name: string; handle: string } | null
}

interface DashboardSummary {
  activeInfluencers: number
  totalPipelineRuns: number
  runningPipelines: number
  pendingPosts: number
  unreadAlerts: number
  todayCost: number
}

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed'

export default function AgentDashboardPage() {
  const { selectedInfluencer } = useInfluencer()
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [jobStats, setJobStats] = useState<JobStats>({ pending: 0, processing: 0, completed: 0, failed: 0 })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTriggering, setIsTriggering] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAllInfluencers, setShowAllInfluencers] = useState(true)

  // Charger les exécutions de pipeline
  const loadRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (!showAllInfluencers && selectedInfluencer) {
        params.set('influencerId', selectedInfluencer.id)
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      params.set('limit', '50')

      const response = await fetch(`/api/agent/runs?${params}`)
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setRuns(data.runs)
    } catch (error) {
      console.error('Erreur chargement runs:', error)
      toast.error('Erreur lors du chargement des exécutions')
    }
  }, [selectedInfluencer, statusFilter, showAllInfluencers])

  // Charger les stats des jobs
  const loadJobStats = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/jobs?limit=1')
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setJobStats(data.stats)
    } catch (error) {
      console.error('Erreur chargement job stats:', error)
    }
  }, [])

  // Charger les alertes
  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/alerts?type=unread')
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Erreur chargement alertes:', error)
    }
  }, [])

  // Charger le résumé du dashboard
  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/metrics?type=summary')
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error('Erreur chargement résumé:', error)
    }
  }, [])

  // Marquer une alerte comme lue
  const dismissAlert = async (alertId: string) => {
    try {
      await fetch('/api/agent/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId })
      })
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (error) {
      console.error('Erreur dismiss alerte:', error)
    }
  }

  // Flag pour éviter les chargements multiples
  const isLoadingRef = useRef(false)

  // Charger les données (sans useCallback pour éviter les re-renders)
  const loadData = async () => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    setIsLoading(true)

    try {
      await Promise.all([loadRuns(), loadJobStats(), loadAlerts(), loadSummary()])
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }

  // Chargement initial uniquement
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recharger quand les filtres changent
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInfluencer?.id, statusFilter, showAllInfluencers])

  // Auto-refresh toutes les 10 secondes si un pipeline est en cours
  useEffect(() => {
    const interval = setInterval(() => {
      const hasRunning = runs.some(r => r.status === 'running' || r.status === 'pending')
      if (hasRunning || jobStats.processing > 0 || jobStats.pending > 0) {
        loadData()
      }
    }, 10000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Déclencher un pipeline
  const triggerPipeline = async () => {
    if (!selectedInfluencer) {
      toast.error('Sélectionnez une influenceuse')
      return
    }

    setIsTriggering(true)
    try {
      const response = await fetch(`/api/agent/pipeline/${selectedInfluencer.id}`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors du déclenchement')
      }

      const data = await response.json()
      toast.success(`Pipeline déclenché pour ${selectedInfluencer.name}`)

      // Recharger les données
      await loadData()
    } catch (error) {
      console.error('Erreur déclenchement:', error)
      toast.error(error instanceof Error ? error.message : 'Erreur lors du déclenchement')
    } finally {
      setIsTriggering(false)
    }
  }

  // Calculer les statistiques
  const stats = {
    total: runs.length,
    running: runs.filter(r => r.status === 'running').length,
    completed: runs.filter(r => r.status === 'completed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    pending: runs.filter(r => r.status === 'pending').length
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Agent Pipeline
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatisation et monitoring des pipelines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => loadData()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              onClick={triggerPipeline}
              disabled={!selectedInfluencer || isTriggering}
            >
              {isTriggering ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {selectedInfluencer ? `Lancer pour ${selectedInfluencer.name}` : 'Sélectionner une influenceuse'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">En cours</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">En attente</span>
            </div>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{stats.pending}</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Terminés</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">Échoués</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>

        {/* Dashboard Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Influenceuses actives</span>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{summary.activeInfluencers}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Posts programmés</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.pendingPosts}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <Bell className="w-4 h-4" />
                <span className="text-sm">Alertes</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{summary.unreadAlerts}</p>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Coût du jour</span>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">${summary.todayCost.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" />
              Alertes non résolues ({alerts.length})
            </h3>
            {alerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  alert.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : alert.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                  alert.type === 'error' ? 'text-red-500' :
                  alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    alert.type === 'error' ? 'text-red-900 dark:text-red-100' :
                    alert.type === 'warning' ? 'text-amber-900 dark:text-amber-100' :
                    'text-blue-900 dark:text-blue-100'
                  }`}>
                    {alert.title}
                  </p>
                  <p className={`text-sm mt-0.5 ${
                    alert.type === 'error' ? 'text-red-700 dark:text-red-300' :
                    alert.type === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                    'text-blue-700 dark:text-blue-300'
                  }`}>
                    {alert.message}
                  </p>
                  {alert.influencer && (
                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                      @{alert.influencer.handle}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Job Queue Stats */}
        {(jobStats.pending > 0 || jobStats.processing > 0) && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  File d&apos;attente des jobs
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {jobStats.processing} en cours • {jobStats.pending} en attente
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Filtres:</span>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            {(['all', 'running', 'pending', 'completed', 'failed'] as StatusFilter[]).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {status === 'all' ? 'Tous' :
                 status === 'running' ? 'En cours' :
                 status === 'pending' ? 'En attente' :
                 status === 'completed' ? 'Terminés' : 'Échoués'}
              </button>
            ))}
          </div>

          {/* Influencer filter */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showAllInfluencers}
                onChange={(e) => setShowAllInfluencers(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              Toutes les influenceuses
            </label>
          </div>
        </div>

        {/* Pipeline Runs */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucune exécution
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {statusFilter !== 'all'
                ? `Aucune exécution avec le statut "${statusFilter}"`
                : 'Lancez votre premier pipeline pour commencer'}
            </p>
            {selectedInfluencer && (
              <Button onClick={triggerPipeline} disabled={isTriggering}>
                <Play className="w-4 h-4 mr-2" />
                Lancer un pipeline
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map(run => (
              <PipelineRunCard
                key={run.id}
                run={run}
                showInfluencer={showAllInfluencers}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
