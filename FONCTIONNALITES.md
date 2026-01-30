# Fiche des Fonctionnalités - AI Influencer Pipeline

## Description Générale

Application web pour automatiser la production de contenu photo et vidéo d'une influenceuse IA. Le workflow complet : **Scraping Instagram → Validation → Description IA → Génération d'images → Génération vidéo → Planification**.

---

## Pages Principales

### 1. Dashboard (`/`)
- **Vue en 3 colonnes** : Sources | Photos à valider | Photos générées
- **Barre de statistiques** : Nombre de sources, photos en attente, approuvées, générées, dernière activité
- **Navigation rapide** vers Calendrier, Vidéos, Paramètres

### 2. Paramètres (`/settings`)
- **Gestion du thème** : Clair / Sombre / Système
- **Photo de référence** : Upload de la photo modèle utilisée pour toutes les générations
- **Clés API** avec boutons de test :
  - Google AI (Gemini 3 Pro)
  - Wavespeed (alternative)
  - Apify (scraping Instagram)
- **Configuration du scraping** :
  - Posts par scrape (1-50)
  - Scraping automatique (on/off)
  - Intervalle (3h, 6h, 12h, 24h)
- **Configuration de génération** :
  - Provider (Gemini ou Wavespeed)
  - Format (9:16, 1:1, 16:9)
  - Qualité (1K, 2K, 4K)

### 3. Vidéos (`/videos`)
- **Upload d'images sources** pour génération vidéo
- **Paramètres vidéo** :
  - Prompt (optionnel)
  - Ratio (9:16, 16:9)
  - Durée (4, 6, 8 secondes)
  - Résolution (720p, 1080p, 4K)
- **Galerie vidéo** avec statuts (en attente, en cours, terminé, échec)

### 4. Calendrier (`/calendar`)
- **Navigation mensuelle** avec statistiques rapides
- **Grille calendrier interactive** montrant les posts planifiés
- **Indicateurs visuels** : Planifié (bleu), Publié (vert), Échec (rouge)
- **Modal détaillé** : Statut, source, caption, hashtags

---

## Fonctionnalités de Gestion des Photos

### Sources Instagram
| Fonctionnalité | Description |
|----------------|-------------|
| Ajouter une source | Créer un nouveau compte Instagram à suivre |
| Modifier une source | Changer le username |
| Supprimer une source | Avec confirmation modale |
| Activer/Désactiver | Toggle pour inclure dans le scraping |

### Validation des Photos
| Fonctionnalité | Description |
|----------------|-------------|
| Carrousel de preview | Navigation entre les photos en attente |
| Raccourcis clavier | ← → A R Escape |
| Approuver | Marque comme approuvée + génère le prompt automatiquement |
| Rejeter | Marque comme rejetée |
| Actions en lot | Sélection multiple pour approuver/rejeter |
| Upload manuel | Ajouter une photo sans scraping |
| Détection carrousel | Identification automatique des posts multi-images |

### Photos Approuvées
| Fonctionnalité | Description |
|----------------|-------------|
| Décrire | Génère le prompt via Gemini 3 Pro |
| Générer | Crée l'image via le provider configuré |
| Actions en lot | Décrire/Générer plusieurs photos |
| Reset | Remettre en attente |

### Photos Générées
| Fonctionnalité | Description |
|----------------|-------------|
| Galerie en grille | Affichage avec lazy loading |
| Télécharger | Individuel ou ZIP complet |
| Supprimer | Avec confirmation |
| Groupement carrousel | Visualisation par groupe |
| Export automation | Vers `ready-to-post/` pour Clawdbot |

---

## Fonctionnalités Vidéo (Veo 3.1)

| Fonctionnalité | Description |
|----------------|-------------|
| Upload source | Glisser-déposer d'images |
| Génération asynchrone | Polling automatique du statut |
| Paramétrage complet | Prompt, ratio, durée, résolution |
| Contraintes auto | 1080p/4K requiert 8 secondes |
| Téléchargement | Une fois la génération terminée |
| Suppression | Avec confirmation |

---

## Scraping Instagram

| Fonctionnalité | Description |
|----------------|-------------|
| Scraping manuel | Bouton sur le dashboard |
| Scraping automatique | Via Vercel Cron (horaire) |
| Configuration intervalle | 3h, 6h, 12h, 24h |
| Import post unique | Coller l'URL d'un post Instagram |
| Détection carrousel | Identifie les posts multi-images |
| Déduplication | Évite les doublons |

---

## Génération IA

### Description (Gemini 3 Pro)
- **Modèle** : `gemini-3-pro-preview`
- **Prompt système** : Préserve l'identité, décrit la scène sans le physique
- **Carrousel intelligent** :
  - Image 1 : Description complète (15-20 lignes)
  - Images 2+ : Format court (changement de pose uniquement)

### Génération d'Images
| Provider | Modèle | Disponibilité |
|----------|--------|---------------|
| Gemini | `gemini-3-pro-image-preview` | Local + Déployé |
| Wavespeed | `nano-banana-pro/edit` | Déployé uniquement |

**Options Gemini** : Format (9:16, 1:1, 16:9) + Qualité (1K, 2K, 4K)
**Retry automatique** : 3 tentatives avec 5s de délai sur erreur 503

### Génération Carrousel Cohérente
1. Image 1 : Photo référence → Gemini → Image générée 1
2. Image 2+ : Image générée précédente → Gemini → Image N
3. Résultat : Ensemble cohérent avec même identité visuelle

---

## Authentification & Sécurité

| Aspect | Détail |
|--------|--------|
| Méthode | Mot de passe unique |
| Token | Cookie HTTP-only signé HMAC SHA256 |
| Durée session | 7 jours |
| Protection | Middleware sur toutes les routes |
| EXIF | Suppression automatique des métadonnées |

---

## API Endpoints (40+)

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion

### Sources
- `GET/POST /api/sources` - Liste/Création
- `GET/PUT/DELETE /api/sources/[id]` - CRUD individuel

### Photos
- `GET /api/photos/pending` - Photos en attente
- `POST /api/photos/[id]/approve` - Approuver + auto-describe
- `POST /api/photos/[id]/reject` - Rejeter
- `POST /api/photos/[id]/describe` - Générer prompt
- `POST /api/photos/[id]/generate` - Générer image
- `POST /api/photos/approve-carousel` - Workflow carrousel complet
- `GET /api/photos/generated/download-all` - ZIP organisé par dossiers

### Vidéos
- `POST /api/videos/sources` - Créer source vidéo
- `POST /api/videos/[id]/generate` - Lancer génération
- `GET /api/videos/[id]/status` - Polling statut
- `GET /api/videos/[id]/download` - Télécharger

### Utilitaires
- `GET /api/stats` - Statistiques dashboard
- `POST /api/test-api` - Tester les APIs
- `GET /api/cron/scrape` - Endpoint cron Vercel

---

## Stockage des Données

| Type | Méthode |
|------|---------|
| Photo référence | Base64 en BDD (Settings) |
| Photos générées | Base64 en BDD (GeneratedPhoto) |
| Sources vidéo | Base64 en BDD (VideoSource) |
| Vidéos générées | URL HTTP (Vertex AI) |
| Posts planifiés | JSON fichier (`data/scheduled-posts.json`) |

---

## Variables d'Environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Oui | PostgreSQL (Neon) |
| `GOOGLE_AI_API_KEY` | Oui | Gemini + Veo |
| `APP_PASSWORD` | Oui | Mot de passe connexion |
| `APP_SECRET` | Oui | Clé signature cookies (32+ chars) |
| `NEXT_PUBLIC_APP_URL` | Requis pour Wavespeed | URL publique de l'app |
| `WAVESPEED_API_KEY` | Non | Si provider Wavespeed |
| `APIFY_API_KEY` | Non | Pour scraping Instagram |
| `CRON_SECRET` | Non | Sécurisation endpoint cron |

---

## Workflow Complet

### Photo Pipeline
```
1. Ajouter source Instagram
2. Scraper (manuel ou auto)
3. Valider photos (approuver/rejeter)
4. Description IA générée automatiquement
5. Génération image (Gemini/Wavespeed)
6. Suppression EXIF
7. Export vers ready-to-post/ (optionnel)
8. Clawdbot planifie la publication
```

### Video Pipeline
```
1. Upload image source
2. Configurer (prompt, ratio, durée, résolution)
3. Lancer génération
4. Polling automatique Veo 3.1
5. Télécharger vidéo terminée
```

---

## Modèles de Données (Prisma)

### Source
- `id` : Identifiant unique (CUID)
- `username` : Nom d'utilisateur Instagram (unique)
- `isActive` : Toggle pour le scraping
- `createdAt`, `updatedAt` : Timestamps

### SourcePhoto
- `id` : Identifiant unique
- `sourceId` : Clé étrangère vers Source
- `originalUrl` : URL image Instagram
- `status` : pending | approved | rejected
- `generatedPrompt` : Prompt IA généré
- `isCarousel`, `carouselId`, `carouselIndex`, `carouselTotal` : Gestion carrousel

### GeneratedPhoto
- `id` : Identifiant unique
- `sourcePhotoId` : Clé étrangère vers SourcePhoto
- `prompt` : Prompt utilisé
- `imageData` : Image en base64
- `isCarousel`, `carouselId`, `carouselIndex`, `carouselTotal` : Gestion carrousel

### VideoSource
- `id` : Identifiant unique
- `originalName` : Nom du fichier original
- `imageData` : Image en base64
- `mimeType` : Type MIME

### GeneratedVideo
- `id` : Identifiant unique
- `sourceId` : Clé étrangère vers VideoSource
- `prompt` : Prompt optionnel
- `aspectRatio` : 9:16 ou 16:9
- `duration` : 4, 6 ou 8 secondes
- `resolution` : 720p, 1080p ou 4k
- `status` : pending | processing | completed | failed
- `operationId` : ID opération Vertex AI
- `gcsUri` : URI Google Cloud Storage

### Settings
- Stockage clé-valeur pour la configuration
- Clés API, photo de référence, options de génération

---

*Dernière mise à jour : Janvier 2025*
