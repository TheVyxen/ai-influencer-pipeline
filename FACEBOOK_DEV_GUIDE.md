# Guide Facebook Developers - Instagram Graph API

Ce guide t'explique comment configurer une app Facebook pour publier automatiquement sur Instagram.

---

## Prérequis

- Un compte Facebook personnel
- Un compte Instagram **Professionnel** ou **Créateur** (pas Personnel)
- Une Page Facebook liée à ton compte Instagram

> **Important** : L'API Instagram ne fonctionne qu'avec les comptes Pro/Créateur, pas les comptes personnels.

---

## Étape 1 : Convertir ton compte Instagram en compte Pro

Si ce n'est pas déjà fait :

1. Ouvrir Instagram > Paramètres
2. Compte > Passer à un compte professionnel
3. Choisir **Créateur** ou **Professionnel**
4. Suivre les étapes

---

## Étape 2 : Lier Instagram à une Page Facebook

1. Sur Instagram : Paramètres > Compte > Partage sur d'autres apps > Facebook
2. Connecter ton compte Facebook
3. Choisir ou créer une Page Facebook à lier

**Vérifier** : Sur ta Page Facebook > Paramètres > Instagram, tu dois voir ton compte Instagram lié.

---

## Étape 3 : Créer une app Facebook Developers

### 3.1 Accéder à Facebook Developers

1. Aller sur https://developers.facebook.com
2. Cliquer sur **"My Apps"** en haut à droite
3. Se connecter avec ton compte Facebook

### 3.2 Créer une nouvelle app

1. Cliquer **"Create App"**
2. Sélectionner **"Other"** puis **"Next"**
3. Choisir **"Business"** comme type d'app
4. Remplir :
   - **App name** : `AI Influencer Pipeline` (ou autre)
   - **App contact email** : ton email
   - **Business Account** : Sélectionner ou créer
5. Cliquer **"Create App"**

---

## Étape 4 : Ajouter les produits nécessaires

Dans le dashboard de ton app :

### 4.1 Ajouter Instagram Basic Display

1. Dans le menu gauche, cliquer **"Add Product"**
2. Trouver **"Instagram Basic Display"**
3. Cliquer **"Set Up"**

### 4.2 Configurer les URLs de callback

Dans Instagram Basic Display > Basic Display :

1. Cliquer **"Create New App"** (en bas)
2. Remplir les champs :

| Champ | Valeur |
|-------|--------|
| **Valid OAuth Redirect URIs** | `https://TON-DOMAINE.com/api/instagram/callback` |
| **Deauthorize Callback URL** | `https://TON-DOMAINE.com/api/instagram/deauthorize` |
| **Data Deletion Request URL** | `https://TON-DOMAINE.com/api/instagram/delete` |

> **Note** : Remplace `TON-DOMAINE.com` par ton vrai domaine (ex: `influencer.vercel.app`)

3. Cliquer **"Save Changes"**

---

## Étape 5 : Ajouter Instagram Graph API

### 5.1 Ajouter le produit

1. Retourner dans **"Add Product"**
2. Trouver **"Instagram Graph API"**
3. Cliquer **"Set Up"**

### 5.2 Configurer les permissions

Dans App Review > Permissions and Features :

Tu auras besoin de ces permissions :
- `instagram_basic` - Lire le profil
- `instagram_content_publish` - Publier du contenu
- `pages_read_engagement` - Lire les infos de la Page
- `pages_show_list` - Lister les Pages

> **Note** : En mode Development, tu peux tester avec ton propre compte sans validation.

---

## Étape 6 : Récupérer les identifiants

### 6.1 App ID et App Secret

1. Aller dans **Settings > Basic**
2. Copier :
   - **App ID** → mettre dans `INSTAGRAM_APP_ID`
   - **App Secret** (cliquer "Show") → mettre dans `INSTAGRAM_APP_SECRET`

### 6.2 Dans ton fichier .env

```env
INSTAGRAM_APP_ID="123456789012345"
INSTAGRAM_APP_SECRET="abcdef123456789..."
ENCRYPTION_KEY="..." # générer avec: openssl rand -hex 32
```

---

## Étape 7 : Ajouter des testeurs (Mode Development)

En mode Development, seuls les testeurs peuvent utiliser l'app.

1. Aller dans **Roles > Roles**
2. Cliquer **"Add Instagram Testers"**
3. Entrer le username Instagram de ton influenceuse
4. L'utilisateur doit accepter l'invitation :
   - Instagram > Paramètres > Site web > Autorisations des apps et des sites web
   - Onglet "Invitations de testeur"
   - Accepter

---

## Étape 8 : Configurer ton app (côté code)

### 8.1 Variables d'environnement complètes

```env
# Facebook/Instagram
INSTAGRAM_APP_ID="ton_app_id"
INSTAGRAM_APP_SECRET="ton_app_secret"
ENCRYPTION_KEY="genere_avec_openssl_rand_hex_32"

# URL publique (OBLIGATOIRE pour Instagram)
NEXT_PUBLIC_APP_URL="https://ton-domaine.com"
```

### 8.2 Générer la clé de chiffrement

```bash
openssl rand -hex 32
```

Copie le résultat dans `ENCRYPTION_KEY`.

---

## Étape 9 : Connecter un compte Instagram dans l'app

Une fois l'app déployée :

1. Aller sur `/influencers`
2. Cliquer sur une influenceuse
3. Section "Compte Instagram" > **"Connecter Instagram"**
4. Autoriser l'accès sur Facebook/Instagram
5. Tu seras redirigé vers l'app avec le compte connecté

---

## Étape 10 : Passer en mode Live (Production)

Pour utiliser l'app avec d'autres comptes que les testeurs :

### 10.1 Vérification de l'entreprise

1. Aller dans **Settings > Basic**
2. Section **Business Verification**
3. Suivre les étapes de vérification

### 10.2 App Review

1. Aller dans **App Review > Permissions and Features**
2. Pour chaque permission nécessaire, cliquer **"Request"**
3. Remplir le formulaire expliquant l'utilisation
4. Fournir une vidéo screencast montrant le flux
5. Soumettre pour review

### 10.3 Passer en Live

1. En haut de la page, toggle **"App Mode"** de Development à **Live**

> **Note** : Pour tester avec ton propre compte, le mode Development suffit.

---

## Résumé des URLs à configurer

| Configuration | URL |
|--------------|-----|
| Valid OAuth Redirect URIs | `https://ton-domaine.com/api/instagram/callback` |
| Deauthorize Callback URL | `https://ton-domaine.com/api/instagram/deauthorize` |
| Data Deletion Request URL | `https://ton-domaine.com/api/instagram/delete` |

---

## Résumé des variables .env

```env
INSTAGRAM_APP_ID="..."
INSTAGRAM_APP_SECRET="..."
ENCRYPTION_KEY="..."
NEXT_PUBLIC_APP_URL="https://ton-domaine.com"
```

---

## Dépannage

### "Invalid redirect URI"
→ Vérifie que l'URL dans Facebook Developers correspond exactement à ton domaine

### "App not authorized"
→ Le compte Instagram doit accepter l'invitation de testeur

### "Instagram account not professional"
→ Convertir le compte en compte Créateur ou Professionnel

### "No linked Facebook Page"
→ Lier une Page Facebook au compte Instagram dans les paramètres Instagram

### Token expiré
→ Les tokens expirent après 60 jours. L'app devrait les rafraîchir automatiquement, sinon reconnecter le compte.

---

## Flux d'autorisation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Ton App   │────▶│   Facebook   │────▶│  Instagram  │
│  (bouton    │     │   Login      │     │  Authorize  │
│  connecter) │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Callback   │
                    │ /api/instagram│
                    │   /callback  │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Token stocké │
                    │   (chiffré)  │
                    │   en BDD     │
                    └──────────────┘
```

---

## Ressources

- Documentation officielle : https://developers.facebook.com/docs/instagram-api
- Permissions : https://developers.facebook.com/docs/permissions/reference
- Graph API Explorer : https://developers.facebook.com/tools/explorer/
