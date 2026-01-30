'use client'

import { Loader2, CheckCircle, XCircle, Clock, Ban, Minus } from 'lucide-react'

type Status = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped'

interface PipelineStatusBadgeProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const STATUS_CONFIG: Record<Status, {
  label: string
  bgColor: string
  textColor: string
  icon: typeof Clock
}> = {
  pending: {
    label: 'En attente',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-600 dark:text-gray-400',
    icon: Clock
  },
  running: {
    label: 'En cours',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    icon: Loader2
  },
  completed: {
    label: 'Terminé',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    icon: CheckCircle
  },
  failed: {
    label: 'Échoué',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    icon: XCircle
  },
  cancelled: {
    label: 'Annulé',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    icon: Ban
  },
  skipped: {
    label: 'Sauté',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-500 dark:text-gray-500',
    icon: Minus
  }
}

const SIZE_CONFIG = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1',
    icon: 'w-3 h-3'
  },
  md: {
    badge: 'px-2.5 py-1 text-sm gap-1.5',
    icon: 'w-4 h-4'
  },
  lg: {
    badge: 'px-3 py-1.5 text-base gap-2',
    icon: 'w-5 h-5'
  }
}

export function PipelineStatusBadge({
  status,
  size = 'md',
  showLabel = true
}: PipelineStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.textColor} ${sizeConfig.badge}`}
    >
      <Icon
        className={`${sizeConfig.icon} ${status === 'running' ? 'animate-spin' : ''}`}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
