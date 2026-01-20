'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

/**
 * Skeleton loader de base
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 rounded',
        className
      )}
    />
  )
}

/**
 * Skeleton pour une carte photo
 */
export function PhotoCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Skeleton pour une grille de photos
 */
export function PhotoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PhotoCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton pour un item de source
 */
export function SourceItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  )
}

/**
 * Skeleton pour la liste de sources
 */
export function SourceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SourceItemSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton pour la barre de stats
 */
export function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 border border-gray-100">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  )
}
