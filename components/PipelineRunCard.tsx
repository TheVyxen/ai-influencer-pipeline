'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, User, Clock, AlertCircle } from 'lucide-react'
import { PipelineStatusBadge } from './PipelineStatusBadge'

interface PipelineStep {
  id: string
  step: string
  status: string
  errorMessage?: string | null
  startedAt?: string | null
  completedAt?: string | null
}

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
  steps: PipelineStep[]
}

interface PipelineRunCardProps {
  run: PipelineRun
  showInfluencer?: boolean
}

const STEP_LABELS: Record<string, string> = {
  scrape: 'Scraping',
  validate: 'Validation',
  describe: 'Description',
  generate: 'Génération',
  caption: 'Captions',
  schedule: 'Programmation'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(startedAt: string, completedAt: string): string {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const durationMs = end - start

  if (durationMs < 1000) {
    return '<1s'
  } else if (durationMs < 60000) {
    return `${Math.round(durationMs / 1000)}s`
  } else {
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.round((durationMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}

export function PipelineRunCard({ run, showInfluencer = false }: PipelineRunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showInfluencer && run.influencer && (
              <>
                {run.influencer.avatarData ? (
                  <img
                    src={run.influencer.avatarData}
                    alt={run.influencer.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {run.influencer.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {run.influencer.handle}
                  </p>
                </div>
              </>
            )}
            <PipelineStatusBadge status={run.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'} />
            {run.currentStep && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {STEP_LABELS[run.currentStep] || run.currentStep}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Statistiques */}
            <div className="hidden sm:flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              {run.photosScraped > 0 && (
                <span>{run.photosScraped} scrapées</span>
              )}
              {run.photosGenerated > 0 && (
                <span>{run.photosGenerated} générées</span>
              )}
            </div>

            {/* Date et durée */}
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(run.createdAt)}
              </div>
              {run.startedAt && run.completedAt && (
                <div className="text-xs">
                  Durée: {formatDuration(run.startedAt, run.completedAt)}
                </div>
              )}
            </div>

            {/* Toggle */}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Erreur */}
        {run.errorMessage && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <span className="font-medium">
                Erreur au step {STEP_LABELS[run.errorStep || ''] || run.errorStep}:
              </span>{' '}
              {run.errorMessage}
            </div>
          </div>
        )}
      </div>

      {/* Steps détaillés */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/50">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Étapes du pipeline
          </h4>
          <div className="space-y-2">
            {run.steps.map(step => (
              <div
                key={step.id}
                className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <PipelineStatusBadge
                    status={step.status as 'pending' | 'running' | 'completed' | 'failed' | 'skipped'}
                    size="sm"
                    showLabel={false}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {STEP_LABELS[step.step] || step.step}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {step.startedAt && step.completedAt && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(step.startedAt, step.completedAt)}
                    </span>
                  )}
                  {step.errorMessage && (
                    <span className="text-xs text-red-500" title={step.errorMessage}>
                      Erreur
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
