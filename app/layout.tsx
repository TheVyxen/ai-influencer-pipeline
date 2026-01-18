import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Influencer Pipeline',
  description: 'Automated photo production pipeline for AI influencer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
