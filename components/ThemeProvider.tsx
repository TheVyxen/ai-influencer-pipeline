'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Hook pour accéder au contexte du thème
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * Provider pour gérer le thème (light/dark/system)
 * Persiste le choix dans localStorage
 * Applique la classe 'dark' sur <html>
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Appliquer le thème sur le document
  const applyTheme = (resolved: 'light' | 'dark') => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    setResolvedTheme(resolved)
  }

  // Résoudre le thème effectif (light ou dark)
  const resolveTheme = (themeValue: Theme): 'light' | 'dark' => {
    if (themeValue === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeValue
  }

  // Changer le thème
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(resolveTheme(newTheme))
  }

  // Initialisation au montage
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    const initialTheme = stored || 'system'
    setThemeState(initialTheme)
    applyTheme(resolveTheme(initialTheme))
    setMounted(true)
  }, [])

  // Écouter les changements de préférence système
  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(mediaQuery.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, mounted])

  // Toujours fournir le contexte, même avant le montage (pour SSG)
  // Les valeurs par défaut sont utilisées avant l'hydratation côté client
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
