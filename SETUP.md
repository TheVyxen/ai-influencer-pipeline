# Guide d'installation - AI Influencer Pipeline

Ce guide liste tout ce que tu dois installer et configurer pour faire fonctionner l'application.

---

## 1. Prérequis locaux

### Node.js (obligatoire)
- **Version** : 18.x ou supérieure
- **Installation** : https://nodejs.org/
- **Vérifier** : `node --version`

### PostgreSQL (optionnel en local)
Si tu veux une base locale au lieu de Neon :
- **Installation** : https://www.postgresql.org/download/
- Ou via Docker (voir section Docker)

---

## 2. Base de données

### Option A : Neon (recommandé, gratuit)
1. Créer un compte sur https://neon.tech
2. Créer un nouveau projet
3. Copier la connection string qui ressemble à :
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. La mettre dans `DATABASE_URL`

### Option B : PostgreSQL local avec Docker
```bash
docker run -d \
  --name postgres-influencer \
  -e POSTGRES_USER=influencer \
  -e POSTGRES_PASSWORD=ton_mot_de_passe \
  -e POSTGRES_DB=influencer_pipeline \
  -p 5432:5432 \
  postgres:15
```
Connection string :
```
DATABASE_URL="postgresql://influencer:ton_mot_de_passe@localhost:5432/influencer_pipeline"
```

---

## 3. APIs externes à configurer

### 3.1 Apify (scraping Instagram) - OBLIGATOIRE
**Utilisé pour** : Récupérer les photos des comptes Instagram sources

1. Créer un compte sur https://apify.com
2. Aller dans Settings > Integrations > API
3. Copier ton **API Token**
4. Le mettre dans `APIFY_API_KEY`

**Coût** : Plan gratuit = 5$ de crédits/mois (suffisant pour tester)

---

### 3.2 Google AI / Gemini - OBLIGATOIRE
**Utilisé pour** :
- Décrire les photos (générer les prompts)
- Générer les nouvelles images (img2img)

1. Aller sur https://aistudio.google.com/apikey
2. Cliquer "Create API Key"
3. Copier la clé
4. La mettre dans `GOOGLE_AI_API_KEY`

**Coût** : Gratuit jusqu'à certaines limites (largement suffisant pour tester)

---

### 3.3 Wavespeed (optionnel)
**Utilisé pour** : Alternative à Gemini si celui-ci est surchargé

1. Créer un compte sur https://wavespeed.ai
2. Aller dans les paramètres API
3. Générer une clé API
4. La mettre dans `WAVESPEED_API_KEY`

**Note** : Wavespeed ne fonctionne qu'en production (besoin d'URLs publiques pour les images)

---

### 3.4 Instagram Graph API (pour publication automatique)
**Utilisé pour** : Publier automatiquement sur Instagram

#### Étape 1 : Créer une app Facebook
1. Aller sur https://developers.facebook.com
2. Cliquer "My Apps" > "Create App"
3. Choisir "Business" comme type d'app
4. Donner un nom à l'app

#### Étape 2 : Configurer Instagram Basic Display
1. Dans ton app, aller dans "Add Products"
2. Ajouter "Instagram Basic Display"
3. Configurer les URLs de callback :
   - **OAuth Redirect URI** : `https://ton-domaine.com/api/instagram/callback`
   - **Deauthorize Callback** : `https://ton-domaine.com/api/instagram/deauthorize`
   - **Data Deletion Request** : `https://ton-domaine.com/api/instagram/delete`

#### Étape 3 : Récupérer les identifiants
1. Aller dans Settings > Basic
2. Copier **App ID** → `INSTAGRAM_APP_ID`
3. Copier **App Secret** → `INSTAGRAM_APP_SECRET`

#### Étape 4 : Passer en mode Live
1. Compléter les vérifications demandées
2. Passer l'app en mode "Live" (pas "Development")

**Note** : Instagram ne fonctionnera qu'une fois l'app déployée avec `NEXT_PUBLIC_APP_URL` configuré.

---

## 4. Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```bash
cp .env.example .env
```

### Variables OBLIGATOIRES

```env
# Base de données
DATABASE_URL="postgresql://..."

# APIs
APIFY_API_KEY="apify_api_..."
GOOGLE_AI_API_KEY="AIza..."

# Authentification (pour protéger l'accès à l'app)
APP_PASSWORD="ton-mot-de-passe-pour-te-connecter"
APP_SECRET="une-cle-aleatoire-de-32-caracteres"
```

### Générer les clés secrètes

```bash
# Générer APP_SECRET (32 caractères)
openssl rand -base64 32

# Générer ENCRYPTION_KEY (pour Instagram, 32 bytes hex)
openssl rand -hex 32

# Générer CRON_SECRET (optionnel)
openssl rand -hex 16
```

### Variables OPTIONNELLES

```env
# Si tu veux utiliser Wavespeed
WAVESPEED_API_KEY="..."

# Si tu veux publier sur Instagram
INSTAGRAM_APP_ID="..."
INSTAGRAM_APP_SECRET="..."
ENCRYPTION_KEY="..."

# URL publique (requis pour Wavespeed et Instagram)
NEXT_PUBLIC_APP_URL="https://ton-domaine.com"

# Sécuriser les cron jobs
CRON_SECRET="..."
```

---

## 5. Installation et lancement

```bash
# 1. Installer les dépendances
npm install

# 2. Initialiser la base de données
npx prisma db push

# 3. Lancer en développement
npm run dev
```

L'app sera disponible sur http://localhost:3000

---

## 6. Premier lancement - Checklist

1. [ ] Se connecter avec `APP_PASSWORD`
2. [ ] Aller dans Settings et vérifier que les APIs sont OK (bouton "Tester")
3. [ ] Créer une influenceuse dans /influencers
4. [ ] Ajouter une photo de référence (modèle)
5. [ ] Ajouter une source Instagram (compte à scraper)
6. [ ] Lancer un scrape manuel
7. [ ] Valider des photos
8. [ ] Générer des images

---

## 7. Récapitulatif des coûts

| Service | Gratuit | Payant |
|---------|---------|--------|
| Neon (BDD) | 0.5 GB gratuit | ~$19/mois |
| Apify | 5$/mois de crédits | Pay-as-you-go |
| Google AI | Généreux quotas gratuits | Pay-as-you-go |
| Wavespeed | - | Pay-as-you-go |
| Instagram API | Gratuit | - |
| Vercel (hébergement) | Gratuit (hobby) | ~$20/mois |

**Pour tester** : Tu peux tout faire gratuitement avec Neon + Apify gratuit + Google AI gratuit.

---

## 8. Dépannage

### "API Key not configured"
→ Vérifier que la variable est bien dans `.env` et redémarrer l'app

### "Database connection failed"
→ Vérifier `DATABASE_URL` et que la base est accessible

### "Instagram token expired"
→ Reconnecter le compte Instagram dans /influencers/[id]

### Erreur 503 Gemini
→ Le service est surchargé, attendre ou basculer sur Wavespeed

---

## 9. Architecture des services

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Influencer Pipeline                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Apify   │───▶│ Validate │───▶│ Describe │              │
│  │ (scrape) │    │ (manual) │    │ (Gemini) │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                        │                     │
│                                        ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │Instagram │◀───│ Schedule │◀───│ Generate │              │
│  │(publish) │    │(calendar)│    │ (Gemini) │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │Instagram│   │ Neon/    │   │ Google   │
    │Graph API│   │PostgreSQL│   │   AI     │
    └─────────┘   └──────────┘   └──────────┘
```

---

## Besoin d'aide ?

- Vérifier les logs dans la console
- Utiliser les boutons "Tester" dans /settings
- Consulter le CLAUDE.md pour la doc technique
