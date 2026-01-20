'use client'

import { Toaster } from 'react-hot-toast'

/**
 * Composant Toast provider avec configuration personnalisée
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#f9fafb',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '14px',
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: '#22c55e',
            secondary: '#f9fafb',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#f9fafb',
          },
          duration: 5000,
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#f9fafb',
          },
        },
      }}
    />
  )
}
