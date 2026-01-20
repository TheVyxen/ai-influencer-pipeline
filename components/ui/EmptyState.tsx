interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
}

/**
 * Composant pour afficher un état vide avec un message
 */
export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="text-gray-300 mb-4">
          {icon}
        </div>
      )}
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  )
}
