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
- **BDD** : SQLite avec Prisma ORM
- **Stockage** : Local (/public/uploads) puis Cloudflare R2
- **UI** : lucide-react (icônes), react-hot-toast (notifications)
- **APIs externes** :
  - Apify (scraping Instagram)
  - Google AI / Gemini (description de photos)
  - Wavespeed (génération img2img)

## Packages installés
```json
{
  "dependencies": {
    "next": "14.2.15",
    "react": "18.3.1",
    "prisma": "5.22.0",
    "@prisma/client": "5.22.0",
    "@google/generative-ai": "0.24.1",
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
  /settings/page.tsx           # Configuration avec test API
  /api/
    /sources/                  # CRUD sources Instagram
    /photos/                   # Gestion photos (approve, reject, describe, generate)
    /scrape/                   # Scraping Instagram
    /settings/                 # Clés API
    /reference/                # Photo de référence
    /test-api/                 # Test connexion APIs
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
  /prisma.ts                   # Client Prisma
  /utils.ts                    # Fonctions utilitaires
  /apify.ts                    # Service Apify
  /google-ai.ts                # Service Google AI
  /wavespeed.ts                # Service Wavespeed
  /exif-remover.ts             # Suppression EXIF
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
- **GeneratedPhoto** : Photos générées (avec prompt utilisé)
- **Settings** : Configuration (clés API, photo référence)

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
- Bouton "Tester" pour chaque API
- Indicateur visuel du statut (vert/rouge)
- Modal de confirmation pour supprimer la photo de référence

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
DATABASE_URL="file:./dev.db"
APIFY_API_KEY=""
GOOGLE_AI_API_KEY=""
WAVESPEED_API_KEY=""
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

### Photo de référence
- Une seule photo de référence pour la modèle
- Stockée dans /public/reference/model.jpg
- Envoyée avec chaque génération Wavespeed comme image d'entrée

### Workflow de validation
1. Photos scrapées arrivent en status "pending"
2. L'utilisateur valide (approved) ou rejette (rejected)
3. Seules les "approved" passent à la génération
4. Après génération, suppression des métadonnées EXIF

## Points d'attention
- Ne jamais exposer les clés API côté client
- Toujours supprimer les EXIF avant stockage final
- Les images scrapées sont temporaires (supprimer après génération)
- Rate limiting sur les APIs (gérer les erreurs 429)

## Commandes utiles
```bash
npm run dev          # Lancer en dev
npx prisma studio    # Visualiser la BDD
npx prisma db push   # Appliquer les changements schema
npm install          # Installer les dépendances
```
