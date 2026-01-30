/**
 * Types partagés pour le système d'agent
 */

// Statuts possibles d'un pipeline
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

// Statuts possibles d'une étape
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// Types de déclenchement
export type TriggerType = 'manual' | 'scheduled' | 'cron'

// Étapes du pipeline (dans l'ordre d'exécution)
export const PIPELINE_STEPS = [
  'scrape',
  'validate',
  'describe',
  'generate',
  'caption',
  'schedule'
] as const

export type PipelineStepName = typeof PIPELINE_STEPS[number]

// Résultat d'une étape
export interface StepResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  skipped?: boolean
  skipReason?: string
}

// Contexte partagé entre les étapes
export interface PipelineContext {
  influencerId: string
  pipelineRunId: string

  // Données accumulées au fil des étapes
  scrapedPhotoIds?: string[]
  validatedPhotoIds?: string[]
  describedPhotoIds?: string[]
  generatedPhotoIds?: string[]
  captionedPhotoIds?: string[]
  scheduledPostIds?: string[]

  // Captions générées (photoId -> caption data)
  captions?: Map<string, { caption: string; hashtags: string[] }>

  // Configuration de l'influenceuse
  settings?: {
    imageProvider: string
    imageAspectRatio: string
    imageSize: string
    postsPerScrape: number
  }
}

// Interface pour un step handler
export interface StepHandler {
  name: PipelineStepName
  execute: (context: PipelineContext) => Promise<StepResult>
}
