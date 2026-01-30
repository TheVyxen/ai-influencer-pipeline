/**
 * Script de migration vers le multi-tenant (Phase 1)
 *
 * Ce script :
 * 1. Crée l'influenceuse "Default" avec les settings actuels
 * 2. Migre la photo de référence de AppSettings vers Influencer.referencePhotoData
 * 3. Associe toutes les Sources existantes à "Default"
 * 4. Associe toutes les VideoSources existantes à "Default"
 * 5. Migre les settings de génération vers InfluencerSettings
 * 6. Nettoie les anciens settings (garde uniquement les clés API globales)
 *
 * Exécuter avec : npx tsx scripts/migrate-to-multi-tenant.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Liste des clés API globales à conserver dans AppSettings
const GLOBAL_API_KEYS = [
  'google_ai_api_key',
  'wavespeed_api_key',
  'apify_api_key'
]

// Liste des settings à migrer vers InfluencerSettings
const INFLUENCER_SETTINGS_KEYS = [
  'image_provider',
  'image_aspect_ratio',
  'image_size',
  'posts_per_scrape',
  'auto_scrape_enabled',
  'auto_scrape_interval',
  'last_auto_scrape'
]

// Liste des settings à migrer vers Influencer (photo de référence)
const INFLUENCER_PHOTO_KEYS = [
  'reference_photo_base64',
  'reference_photo_format'
]

async function migrate() {
  console.log('=== Migration Multi-Tenant - Phase 1 ===\n')

  try {
    // 1. Vérifier si une influenceuse "Default" existe déjà
    console.log('1. Vérification de l\'influenceuse Default...')
    let defaultInfluencer = await prisma.influencer.findUnique({
      where: { handle: '@default' }
    })

    if (defaultInfluencer) {
      console.log('   -> Influenceuse Default existe déjà (ID: ' + defaultInfluencer.id + ')')
    } else {
      // Récupérer les settings actuels pour la migration
      console.log('   -> Création de l\'influenceuse Default...')

      const allSettings = await prisma.appSettings.findMany()
      const settingsMap = new Map(allSettings.map(s => [s.key, s.value]))

      // Récupérer la photo de référence
      const referencePhotoData = settingsMap.get('reference_photo_base64') || null

      // Créer l'influenceuse Default
      defaultInfluencer = await prisma.influencer.create({
        data: {
          name: 'Default',
          handle: '@default',
          referencePhotoData,
          settings: {
            create: {
              imageProvider: settingsMap.get('image_provider') || 'gemini',
              imageAspectRatio: settingsMap.get('image_aspect_ratio') || '9:16',
              imageSize: settingsMap.get('image_size') || '2K',
              postsPerScrape: parseInt(settingsMap.get('posts_per_scrape') || '10', 10),
              autoScrapeEnabled: settingsMap.get('auto_scrape_enabled') === 'true',
              autoScrapeInterval: parseInt(settingsMap.get('auto_scrape_interval') || '24', 10),
              lastAutoScrape: settingsMap.get('last_auto_scrape')
                ? new Date(settingsMap.get('last_auto_scrape')!)
                : null
            }
          }
        }
      })

      console.log('   -> Influenceuse Default créée (ID: ' + defaultInfluencer.id + ')')
    }

    // 2. Associer toutes les Sources orphelines à Default
    console.log('\n2. Migration des Sources...')
    const orphanSources = await prisma.source.findMany({
      where: { influencerId: null }
    })

    if (orphanSources.length > 0) {
      await prisma.source.updateMany({
        where: { influencerId: null },
        data: { influencerId: defaultInfluencer.id }
      })
      console.log('   -> ' + orphanSources.length + ' source(s) associée(s) à Default')
    } else {
      console.log('   -> Aucune source orpheline')
    }

    // 3. Associer toutes les VideoSources orphelines à Default
    console.log('\n3. Migration des VideoSources...')
    const orphanVideoSources = await prisma.videoSource.findMany({
      where: { influencerId: null }
    })

    if (orphanVideoSources.length > 0) {
      await prisma.videoSource.updateMany({
        where: { influencerId: null },
        data: { influencerId: defaultInfluencer.id }
      })
      console.log('   -> ' + orphanVideoSources.length + ' videoSource(s) associée(s) à Default')
    } else {
      console.log('   -> Aucune videoSource orpheline')
    }

    // 4. Nettoyer les settings obsolètes (garder uniquement les clés API)
    console.log('\n4. Nettoyage des settings obsolètes...')
    const keysToDelete = [
      ...INFLUENCER_SETTINGS_KEYS,
      ...INFLUENCER_PHOTO_KEYS
    ]

    const deleteResult = await prisma.appSettings.deleteMany({
      where: {
        key: { in: keysToDelete }
      }
    })

    console.log('   -> ' + deleteResult.count + ' setting(s) migré(s) et supprimé(s)')

    // 5. Afficher le résumé
    console.log('\n=== Migration terminée ===')
    console.log('\nRésumé :')
    console.log('- Influenceuse Default : ' + defaultInfluencer.id)
    console.log('- Sources migrées : ' + orphanSources.length)
    console.log('- VideoSources migrées : ' + orphanVideoSources.length)
    console.log('- Settings nettoyés : ' + deleteResult.count)

    console.log('\nProchaines étapes :')
    console.log('1. Vérifier que l\'app fonctionne correctement')
    console.log('2. Créer d\'autres influenceuses si nécessaire')
    console.log('3. Re-configurer la photo de référence par influenceuse')

  } catch (error) {
    console.error('\n!!! ERREUR lors de la migration !!!')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la migration
migrate()
