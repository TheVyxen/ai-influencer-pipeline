/**
 * Script pour démarrer le worker de pipeline
 * Usage: npx tsx scripts/start-worker.ts
 *
 * Ce worker poll la base de données pour exécuter les jobs en attente.
 * Il est conçu pour tourner sur un serveur dédié (pas serverless).
 */

import { startWorker, stopWorker } from '../lib/agent/worker'

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n[Worker] Received SIGINT, stopping...')
  stopWorker()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n[Worker] Received SIGTERM, stopping...')
  stopWorker()
  process.exit(0)
})

// Démarrer le worker
console.log('========================================')
console.log('  AI Influencer Pipeline - Worker')
console.log('========================================')
console.log('')

startWorker().catch(error => {
  console.error('[Worker] Fatal error:', error)
  process.exit(1)
})
