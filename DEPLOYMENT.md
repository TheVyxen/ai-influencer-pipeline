# Guide de déploiement sur Vercel

Ce guide explique comment déployer l'application AI Influencer Pipeline sur Vercel avec une base de données PostgreSQL sur Neon.

## Prérequis

- Un compte GitHub avec le repo pushé
- Un compte Vercel (gratuit) : https://vercel.com
- Un compte Neon (gratuit) : https://neon.tech

## Étape 1 : Créer la base de données Neon

### 1.1 Créer un compte Neon

1. Aller sur https://neon.tech
2. Cliquer sur "Sign Up"
3. Se connecter avec GitHub (recommandé) ou email

### 1.2 Créer un projet

1. Cliquer sur "New Project"
2. **Project name** : `ai-influencer-pipeline`
3. **Region** : Choisir la plus proche de vos utilisateurs
   - Europe : `eu-central-1` (Frankfurt)
   - US : `us-east-1` (Virginia)
4. Cliquer sur "Create Project"

### 1.3 Copier la connection string

1. Une fois le projet créé, vous verrez la **Connection string**
2. Cliquer sur l'icône de copie pour copier l'URL complète
3. Elle ressemble à :
   ```
   postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Gardez cette URL**, vous en aurez besoin pour Vercel

## Étape 2 : Déployer sur Vercel

### 2.1 Importer le projet

1. Aller sur https://vercel.com/new
2. Cliquer sur "Import Git Repository"
3. Sélectionner votre repo `ai-influencer-pipeline`
4. Cliquer sur "Import"

### 2.2 Configurer les variables d'environnement

Avant de cliquer sur "Deploy", configurer les variables d'environnement :

| Variable | Valeur | Obligatoire |
|----------|--------|-------------|
| `DATABASE_URL` | Votre connection string Neon | ✅ |
| `GOOGLE_AI_API_KEY` | Votre clé API Google AI | ✅ |
| `APIFY_API_KEY` | Votre clé API Apify | ✅ |
| `WAVESPEED_API_KEY` | Votre clé API Wavespeed | ❌ |
| `NEXT_PUBLIC_APP_URL` | (laisser vide pour l'instant) | ❌ |

Pour ajouter chaque variable :
1. Cliquer sur "Environment Variables"
2. Entrer le nom de la variable (ex: `DATABASE_URL`)
3. Entrer la valeur
4. Cliquer sur "Add"
5. Répéter pour chaque variable

### 2.3 Déployer

1. Cliquer sur "Deploy"
2. Attendre que le build se termine (2-3 minutes)
3. Une fois terminé, Vercel affiche l'URL de votre app (ex: `https://ai-influencer-pipeline.vercel.app`)

### 2.4 Configurer NEXT_PUBLIC_APP_URL (si vous utilisez Wavespeed)

1. Aller dans les settings du projet sur Vercel
2. Cliquer sur "Environment Variables"
3. Ajouter :
   - **Name** : `NEXT_PUBLIC_APP_URL`
   - **Value** : L'URL de votre app (ex: `https://ai-influencer-pipeline.vercel.app`)
4. Cliquer sur "Save"
5. Aller dans "Deployments" et cliquer sur "Redeploy" sur le dernier déploiement

## Étape 3 : Initialiser la base de données

La base de données est créée automatiquement lors du premier déploiement grâce au script `postinstall` qui exécute `prisma generate`.

Cependant, les tables ne sont pas encore créées. Vous avez deux options :

### Option A : Depuis votre machine locale (recommandé)

```bash
# 1. Mettre à jour votre .env local avec la connection string Neon
# DATABASE_URL="postgresql://..."

# 2. Générer le client Prisma
npx prisma generate

# 3. Créer les tables dans Neon
npx prisma db push

# 4. Vérifier que ça fonctionne
npx prisma studio
```

### Option B : Depuis Vercel (via le terminal)

Non recommandé car les fonctions serverless ne permettent pas d'exécuter des commandes interactives.

## Étape 4 : Vérifier le déploiement

1. Ouvrir l'URL de votre app (ex: `https://ai-influencer-pipeline.vercel.app`)
2. Aller dans Settings
3. Vérifier que les APIs sont configurées (bouton "Tester")
4. Ajouter une source Instagram et lancer un scrape

## Dépannage

### Erreur "PrismaClientInitializationError: Environment variable not found"

**Cause** : La variable `DATABASE_URL` n'est pas configurée sur Vercel.

**Solution** :
1. Aller dans Vercel > Settings > Environment Variables
2. Vérifier que `DATABASE_URL` existe et contient la connection string Neon
3. Redéployer l'application

### Erreur "Can't reach database server"

**Cause** : La connection string est incorrecte ou le projet Neon est en pause.

**Solution** :
1. Vérifier la connection string dans le dashboard Neon
2. S'assurer que `?sslmode=require` est présent
3. Aller sur Neon et vérifier que le projet n'est pas en pause

### Erreur "relation does not exist"

**Cause** : Les tables n'ont pas été créées dans la base de données.

**Solution** :
```bash
# Depuis votre machine locale avec DATABASE_URL configuré
npx prisma db push
```

### Le build échoue sur Vercel

**Cause possible** : Problème avec Prisma generate.

**Solution** : Vérifier que `package.json` contient :
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

### Les images ne s'affichent pas

**Cause** : Les images stockées localement (`/public/uploads`) ne persistent pas sur Vercel.

**Solution** : Utiliser un stockage cloud comme Cloudflare R2 ou AWS S3 pour les images (migration future).

## Commandes utiles

```bash
# Générer le client Prisma
npx prisma generate

# Créer/mettre à jour les tables
npx prisma db push

# Visualiser la base de données
npx prisma studio

# Voir les logs Prisma
DEBUG="prisma:*" npx prisma db push
```

## Architecture finale

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │────▶│    Neon     │     │   Apify     │
│  (Next.js)  │     │ (PostgreSQL)│     │ (Scraping)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────┐                        ┌─────────────┐
│  Google AI  │                        │  Wavespeed  │
│  (Gemini 3) │                        │ (Fallback)  │
└─────────────┘                        └─────────────┘
```

## Coûts estimés (tier gratuit)

| Service | Tier gratuit | Limite |
|---------|--------------|--------|
| Vercel | Hobby | 100GB bandwidth/mois |
| Neon | Free | 512MB storage, 0.25 vCPU |
| Apify | Free | $5 crédit/mois |
| Google AI | Free | Quotas généreux |
| Wavespeed | Pay-as-you-go | Variable |

## Prochaines étapes

1. ✅ Base de données migrée vers Neon
2. ⬜ Migrer le stockage d'images vers Cloudflare R2
3. ⬜ Configurer un domaine personnalisé
4. ⬜ Ajouter du monitoring (Vercel Analytics)
