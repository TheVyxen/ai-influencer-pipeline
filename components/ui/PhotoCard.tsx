'use client'

import Image from 'next/image'

interface PhotoCardProps {
  imageSrc: string
  subtitle?: string
  date?: Date
  actions?: React.ReactNode
}

/**
 * Card réutilisable pour afficher une photo avec des actions
 */
export function PhotoCard({ imageSrc, subtitle, date, actions }: PhotoCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square relative bg-gray-100">
        <Image
          src={imageSrc}
          alt="Photo"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 200px"
        />
      </div>
      <div className="p-3">
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
        {date && (
          <p className="text-xs text-gray-400 mt-1">
            {new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(date)}
          </p>
        )}
        {actions && (
          <div className="mt-2 flex gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
