# Migration SQLite → PostgreSQL (Neon)

Ce guide explique comment migrer la base de données de SQLite vers PostgreSQL hébergé sur Neon.

## Pourquoi cette migration ?

SQLite stocke les données dans un fichier local (`dev.db`). Sur Vercel (environnement serverless), le système de fichiers est **éphémère** - les données sont perdues entre chaque requête. PostgreSQL sur Neon résout ce problème avec une base de données cloud persistante.

## Prérequis

- Node.js 18+
- npm ou yarn
- Un compte Neon (gratuit) : https://neon.tech

## Étapes de migration

### 1. Créer une base de données Neon

1. Aller sur https://console.neon.tech
2. Cliquer sur "New Project"
3. Choisir un nom (ex: `ai-influencer-pipeline`)
4. Sélectionner la région la plus proche (ex: `eu-central-1` pour l'Europe)
5. Cliquer sur "Create Project"

### 2. Récupérer la connection string

1. Dans le dashboard Neon, aller dans "Connection Details"
2. Copier la connection string qui ressemble à :
   ```
   postgresql://username:password@ep-xxx-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### 3. Configurer l'environnement local

Créer un fichier `.env` à la racine du projet (si pas déjà fait) :

```bash
cp .env.example .env
```

Remplacer `DATABASE_URL` par votre connection string Neon :

```env
DATABASE_URL="postgresql://username:password@ep-xxx-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

### 4. Générer le client Prisma

```bash
npx prisma generate
```

### 5. Créer les tables dans PostgreSQL

```bash
npx prisma db push
```

Cette commande crée toutes les tables (Source, SourcePhoto, GeneratedPhoto, Settings) dans votre base Neon.

### 6. Vérifier la connexion

```bash
npx prisma studio
```

Cela ouvre une interface web pour visualiser votre base de données. Si ça fonctionne, la migration est réussie !

## Migration des données existantes (optionnel)

Si vous avez des données dans SQLite que vous souhaitez conserver :

### Export depuis SQLite

1. Garder une copie de votre ancien `.env` avec SQLite :
   ```bash
   cp .env .env.sqlite
   ```

2. Exporter les données avec Prisma Studio ou un script personnalisé.

### Script d'export (si besoin)

Créer un fichier `scripts/export-data.js` :

```javascript
const { PrismaClient } = require('@prisma/client');

// Configurer pour SQLite
process.env.DATABASE_URL = 'file:./prisma/dev.db';

const prisma = new PrismaClient();

async function exportData() {
  const sources = await prisma.source.findMany();
  const sourcePhotos = await prisma.sourcePhoto.findMany();
  const generatedPhotos = await prisma.generatedPhoto.findMany();
  const settings = await prisma.settings.findMany();

  const data = { sources, sourcePhotos, generatedPhotos, settings };

  require('fs').writeFileSync(
    'data-export.json',
    JSON.stringify(data, null, 2)
  );

  console.log('Data exported to data-export.json');
}

exportData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Script d'import

Créer un fichier `scripts/import-data.js` :

```javascript
const { PrismaClient } = require('@prisma/client');
const data = require('../data-export.json');

const prisma = new PrismaClient();

async function importData() {
  // Importer dans l'ordre pour respecter les relations
  for (const source of data.sources) {
    await prisma.source.create({ data: source });
  }
  console.log(`Imported ${data.sources.length} sources`);

  for (const photo of data.sourcePhotos) {
    await prisma.sourcePhoto.create({ data: photo });
  }
  console.log(`Imported ${data.sourcePhotos.length} source photos`);

  for (const photo of data.generatedPhotos) {
    await prisma.generatedPhoto.create({ data: photo });
  }
  console.log(`Imported ${data.generatedPhotos.length} generated photos`);

  for (const setting of data.settings) {
    await prisma.settings.create({ data: setting });
  }
  console.log(`Imported ${data.settings.length} settings`);
}

importData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Commandes récapitulatives

```bash
# 1. Générer le client Prisma
npx prisma generate

# 2. Créer les tables (première fois)
npx prisma db push

# 3. Visualiser la base de données
npx prisma studio

# 4. Réinitialiser la base (ATTENTION: supprime toutes les données)
npx prisma db push --force-reset
```

## Dépannage

### Erreur "Connection refused"

Vérifier que :
- La connection string est correcte
- `?sslmode=require` est présent à la fin de l'URL
- Le projet Neon est actif (pas en pause)

### Erreur "Role does not exist"

La connection string utilise peut-être un mauvais utilisateur. Récupérer une nouvelle connection string depuis le dashboard Neon.

### Erreur de timeout

Les projets Neon gratuits se mettent en pause après 5 minutes d'inactivité. La première requête peut prendre 2-3 secondes pour "réveiller" la base.

## Différences SQLite vs PostgreSQL

| Aspect | SQLite | PostgreSQL |
|--------|--------|------------|
| Stockage | Fichier local | Cloud |
| Persistance Vercel | Non | Oui |
| Concurrence | Limitée | Illimitée |
| Prix | Gratuit | Gratuit (tier Free) |
| Cold start | Aucun | ~2s après pause |
