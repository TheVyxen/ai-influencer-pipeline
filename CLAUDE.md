# CLAUDE.md - AI Influencer Photo Pipeline

## Description du projet
Application web pour automatiser la chaîne de production photo d'une influenceuse IA.
Le workflow : Scraping Instagram → Validation manuelle → Description IA → Génération img2img → Suppression EXIF → Stockage

## Contexte utilisateur
- Développeur débutant (vibe coding)
- Seul sur le projet
- Besoin de code clair, commenté, et facile à maintenir

## Stack technique
- **Framework** : Next.js 14 (App Router)
- **Langage** : TypeScript
- **Style** : Tailwind CSS
- **BDD** : PostgreSQL (Neon) avec Prisma ORM
- **Stockage** : Local (/public/uploads) puis Cloudflare R2
- **UI** : lucide-react (icônes), react-hot-toast (notifications)
- **APIs externes** :
  - Apify (scraping Instagram)
  - Google AI / Gemini 3 (description + génération d'images)
  - Wavespeed (génération d'images alternative)

## Providers de génération d'images

### Gemini 3 Pro Image (recommandé)
- **Modèle** : `gemini-3-pro-image-preview`
- **Description** : `gemini-3-pro-preview` (avec thinkingLevel: "low")
- **Retry automatique** : 3 tentatives avec 5s de délai pour les erreurs 503
- **Options** : format (9:16, 1:1, 16:9), qualité (1K, 2K, 4K)

### Wavespeed (alternative)
- **Modèle** : `google/nano-banana-pro/edit`
- **Utilisation** : En cas de surcharge Gemini (erreur 503)
- **Bascule** : Manuelle dans Settings > Provider de génération
- **Prérequis** : L'app doit être déployée avec `NEXT_PUBLIC_APP_URL` configuré
- **En local** : Non disponible (utiliser Gemini)

### Comment basculer entre les providers
1. Aller dans Settings
2. Section "Configuration de génération"
3. Cliquer sur le provider souhaité (Gemini ou Wavespeed)
4. Sauvegarder les paramètres

## Packages installés
```json
{
  "dependencies": {
    "next": "14.2.15",
    "react": "18.3.1",
    "prisma": "5.22.0",
    "@prisma/client": "5.22.0",
    "@google/genai": "latest",
    "apify-client": "2.21.0",
    "sharp": "0.34.5",
    "archiver": "7.0.1",
    "react-hot-toast": "^2.4.1",
    "lucide-react": "^0.468.0"
  }
}
```

## Structure du projet
```
/app
  /page.tsx                    # Dashboard principal avec StatsBar
  /login/page.tsx              # Page de connexion (auth)
  /settings/page.tsx           # Configuration avec test API + provider
  /api/
    /auth/                     # Authentification (login, logout)
    /sources/                  # CRUD sources Instagram
    /photos/                   # Gestion photos (approve, reject, describe, generate)
    /scrape/                   # Scraping Instagram
    /settings/                 # Clés API
    /reference/                # Photo de référence
    /test-api/                 # Test connexion APIs (Google AI, Wavespeed, Apify)
    /health/                   # Health check
/components
  /ui/
    /button.tsx                # Bouton avec variantes
    /Toast.tsx                 # Provider pour react-hot-toast
    /ConfirmModal.tsx          # Modal de confirmation
    /Skeleton.tsx              # Skeletons de chargement
    /PhotoCard.tsx             # Carte photo réutilisable
    /EmptyState.tsx            # État vide
  /SourceList.tsx              # Liste des sources Instagram
  /PhotoValidation.tsx         # Photos à valider (batch actions)
  /ApprovedPhotos.tsx          # Photos approuvées (batch actions)
  /GeneratedGallery.tsx        # Galerie photos générées
  /StatsBar.tsx                # Barre de statistiques
/lib
  /auth.ts                     # Authentification (signToken, verifyToken)
  /prisma.ts                   # Client Prisma
  /utils.ts                    # Fonctions utilitaires
  /apify.ts                    # Service Apify
  /google-ai.ts                # Service Google AI (description + génération Gemini)
  /wavespeed.ts                # Service Wavespeed (génération alternative)
  /exif-remover.ts             # Suppression EXIF
/middleware.ts                 # Protection des routes par authentification
/prisma
  /schema.prisma               # Schéma BDD
/public
  /uploads/                    # Images uploadées
  /generated/                  # Images générées
  /reference/                  # Photo de référence modèle
```

## Modèles de données (Prisma)
- **Source** : Comptes Instagram à scraper (username)
- **SourcePhoto** : Photos scrapées (status: pending/approved/rejected)
- **GeneratedPhoto** : Photos générées via Gemini 3 ou Wavespeed (avec prompt utilisé)
- **Settings** : Configuration (clés API, photo référence, options génération)

## Settings stockés
- `google_ai_api_key` : Clé API Google AI
- `wavespeed_api_key` : Clé API Wavespeed (optionnel)
- `apify_api_key` : Clé API Apify
- `posts_per_scrape` : Nombre de posts par scrape (défaut: 10)
- `image_provider` : Provider de génération (gemini, wavespeed) - défaut: gemini
- `image_aspect_ratio` : Format d'image (9:16, 1:1, 16:9) - défaut: 9:16
- `image_size` : Qualité d'image (1K, 2K, 4K) - défaut: 2K

## Authentification

L'application est protégée par un mot de passe unique.

### Fonctionnement
- Un middleware Next.js (`middleware.ts`) intercepte toutes les requêtes
- Sans cookie valide → redirection vers `/login`
- Le cookie `auth-token` est signé avec HMAC SHA256 (clé: `APP_SECRET`)
- Session valide 7 jours

### Configuration
1. Définir `APP_PASSWORD` dans les variables d'environnement
2. Définir `APP_SECRET` (clé secrète pour signer les cookies, min 32 caractères)
3. Se connecter via `/login` avec le mot de passe
4. Se déconnecter via le bouton dans Settings

### Sécurité
- Cookie HTTP-only (non accessible en JavaScript)
- Cookie Secure en production (HTTPS uniquement)
- Signature HMAC pour éviter la falsification
- Expiration automatique après 7 jours

## Fonctionnalités UX

### Notifications toast
- Succès, erreurs et info via react-hot-toast
- Position: bottom-right
- Toasts persistants pour les opérations longues

### Actions en lot (Batch actions)
- **Photos à valider** : Sélection multiple, valider/rejeter en lot
- **Photos approuvées** : Sélection multiple, décrire/générer en lot
- **Photos générées** : Sélection multiple, téléchargement ZIP, suppression

### Modales de confirmation
- Suppression de source
- Rejet de photo(s)
- Suppression de photo(s) générée(s)
- Suppression photo de référence

### Raccourcis clavier (Photos à valider)
- `←` / `→` : Naviguer entre les photos
- `A` : Approuver la photo sélectionnée
- `R` : Rejeter la photo sélectionnée
- `Escape` : Fermer les modales

### Barre de statistiques
- Nombre de sources
- Photos en attente (pending)
- Photos approuvées
- Photos générées
- Dernière activité

### Page Settings améliorée
- Bouton "Tester" pour chaque API (Google AI, Wavespeed, Apify)
- Indicateur visuel du statut (vert/rouge)
- Modal de confirmation pour supprimer la photo de référence
- **Sélecteur de provider** : Gemini 3 ou Wavespeed
- Sélecteurs pour le format et la qualité des images (Gemini uniquement)

## Règles de code
1. Toujours commenter les fonctions complexes
2. Utiliser des noms de variables explicites en anglais
3. Gérer les erreurs avec try/catch et messages clairs (toast.error)
4. Typer toutes les fonctions (TypeScript strict)
5. Un composant = un fichier
6. Les appels API dans /lib, jamais dans les composants
7. Utiliser lucide-react pour les icônes
8. Utiliser react-hot-toast pour les notifications

## Variables d'environnement requises
```
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"  # Neon PostgreSQL
APIFY_API_KEY=""
GOOGLE_AI_API_KEY=""
WAVESPEED_API_KEY=""       # Optionnel, requis si provider=wavespeed
NEXT_PUBLIC_APP_URL=""     # URL publique après déploiement (requis pour Wavespeed)
APP_PASSWORD=""            # Mot de passe pour accéder à l'application
APP_SECRET=""              # Clé secrète pour signer les cookies (min 32 caractères)
```

## Logique métier importante

### Prompt de génération
Le prompt DOIT toujours commencer par :
"Preserve the identity of the person from the input image."

Le prompt décrit :
- La position / pose
- L'environnement / décor
- Les vêtements
- L'éclairage
- Le style photo

Le prompt ne décrit JAMAIS le physique de la personne (visage, corps, etc.)

### Description des carrousels
Pour les posts Instagram avec plusieurs images (carrousels), la logique est différente :

**Image 1** : Description complète (environnement, tenue, éclairage, pose, style)
```
Preserve the identity of the person from the input image. Ultra-realistic outdoor scene...
[description détaillée sur 15-20 lignes]
```

**Images 2+** : Format court, uniquement le changement de pose
```
Preserve the identity of the person from the input image. Same scene, same outfit, same lighting, same environment. Only the pose changes: [description de la pose en 1-2 phrases]. Ultra-realistic, identical setting preserved.
```

**Implémentation** : Appels API individuels pour chaque image (pas de batch) pour garantir la fiabilité du format

### Photo de référence
- Une seule photo de référence pour la modèle
- Stockée dans /public/reference/model.jpg
- Envoyée avec chaque génération (Gemini ou Wavespeed) comme image d'entrée

### Configuration de génération
- **Provider** : Gemini (défaut) ou Wavespeed
- **Format (aspectRatio)** : 9:16 (portrait), 1:1 (carré), 16:9 (paysage)
- **Qualité (imageSize)** : 1K (rapide), 2K (recommandé), 4K (haute qualité)
- Ces paramètres sont configurables dans la page Settings

### Disponibilité des providers
| Situation | Gemini | Wavespeed |
|-----------|--------|-----------|
| En local | Fonctionne | Non disponible |
| Déployé sans `NEXT_PUBLIC_APP_URL` | Fonctionne | Non disponible |
| Déployé avec `NEXT_PUBLIC_APP_URL` | Fonctionne | Fonctionne |

### Workflow de validation
1. Photos scrapées arrivent en status "pending"
2. L'utilisateur valide (approved) ou rejette (rejected)
3. Seules les "approved" passent à la génération
4. Après génération, suppression des métadonnées EXIF

## Gestion d'erreurs

### Erreurs Gemini
- **NOT_CONFIGURED** : Clé API non configurée
- **RATE_LIMIT** : Trop de requêtes (429)
- **CONTENT_BLOCKED** : Contenu refusé par les filtres de sécurité
- **TIMEOUT** : Génération trop longue
- **INVALID_IMAGE** : Image non analysable
- **GENERATION_FAILED** : Échec de génération
- **503/Overloaded** : Retry automatique (3x), sinon suggestion de basculer sur Wavespeed

### Erreurs Wavespeed
- **NOT_CONFIGURED** : Clé API non configurée
- **NOT_DEPLOYED** : L'app n'est pas déployée (NEXT_PUBLIC_APP_URL manquant)
- **RATE_LIMIT** : Trop de requêtes (429)
- **API_ERROR** : Erreur de l'API Wavespeed
- **TIMEOUT** : Génération trop longue
- **GENERATION_FAILED** : Échec de génération
- **NO_OUTPUT** : Aucune image générée

## Points d'attention
- Ne jamais exposer les clés API côté client
- Toujours supprimer les EXIF avant stockage final
- Les images scrapées sont temporaires (supprimer après génération)
- Rate limiting sur les APIs (gérer les erreurs 429)
- Les filtres de sécurité Gemini peuvent bloquer certains contenus
- **En cas de surcharge Gemini (503)** : basculer manuellement sur Wavespeed
- **Wavespeed en local** : Non disponible car nécessite des URLs publiques pour les images
- **Après déploiement** : Configurer `NEXT_PUBLIC_APP_URL` pour activer Wavespeed

## Commandes utiles
```bash
npm run dev          # Lancer en dev
npx prisma studio    # Visualiser la BDD
npx prisma db push   # Appliquer les changements schema
npm install          # Installer les dépendances
```
