import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/ThemeProvider'
import { InfluencerProvider } from '@/lib/hooks/use-influencer-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Influencer Pipeline',
  description: 'Automated photo production pipeline for AI influencer',
}

/**
 * Script inline pour éviter le flash de thème incorrect
 * S'exécute avant le rendu React
 */
const themeScript = `
  (function() {
    const stored = localStorage.getItem('theme');
    const theme = stored || 'system';
    let dark = false;

    if (theme === 'dark') {
      dark = true;
    } else if (theme === 'system') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (dark) {
      document.documentElement.classList.add('dark');
    }
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          <InfluencerProvider>
            {children}
          </InfluencerProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  )
}
