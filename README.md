# 🗡️ SwordManager — Backend

API REST du gestionnaire de mots de passe **zero-knowledge** SwordManager. Le serveur ne connaît jamais le mot de passe maître d'un utilisateur ni la clé de chiffrement de son coffre : il ne stocke que des données déjà chiffrées côté client (voir [Architecture zero-knowledge](#-architecture-zero-knowledge)).

Dépôt du frontend associé : [SwordManager-FrontEnd](../SwordManager-FrontEnd).

## Sommaire

- [Stack technique](#-stack-technique)
- [Architecture zero-knowledge](#-architecture-zero-knowledge)
- [Structure du projet](#-structure-du-projet)
- [Installation](#-installation)
- [Variables d'environnement](#-variables-denvironnement)
- [Lancement](#-lancement)
- [Documentation de l'API](#-documentation-de-lapi)
- [Sécurité](#-sécurité)
- [Déploiement](#-déploiement)

## 🛠️ Stack technique

| Domaine | Choix |
|---|---|
| Runtime | Node.js 20 |
| Framework HTTP | Express 5 |
| Base de données | PostgreSQL, via Sequelize (ORM, `sync()` — pas de migrations) |
| Authentification | JWT (`jsonwebtoken`), expiration 1h |
| Hash de mot de passe | Argon2id (`argon2`) |
| Email transactionnel | SendGrid (`@sendgrid/mail`) |
| Sécurité HTTP | `helmet`, `cors`, `express-rate-limit` |
| Formatage | Prettier |

## 🔐 Architecture zero-knowledge

Le client (frontend) dérive localement, à partir du mot de passe maître :
- une **clé de chiffrement** (PBKDF2, 600 000 itérations) qui chiffre/déchiffre le coffre en local ;
- un **`authHash`** (SHA-256 de cette clé) envoyé au serveur en guise de "mot de passe" — le serveur ne voit donc jamais le mot de passe maître ni la clé réelle.

Le serveur stocke :
- `passwordHash` : hash Argon2 de l'`authHash` reçu (jamais le mot de passe maître) ;
- `protectedKey` : la clé du coffre (`rawVaultKey`), chiffrée côté client sous la clé dérivée du mot de passe ;
- `recoveryProtectedKey` (optionnel) : la même clé de coffre, chiffrée sous une clé de récupération distincte générée côté client, pour permettre une réinitialisation du mot de passe sans jamais perdre l'accès au coffre.

Ce backend ne fait que persister et restituer ces blobs opaques — il n'a jamais la capacité de déchiffrer un coffre.

## 📂 Structure du projet

```
src/
├── index.js                    # Point d'entrée : middlewares globaux, montage des routes, démarrage
├── config/
│   └── database.js             # Connexion Sequelize/PostgreSQL
├── models/
│   └── index.js                # User, VaultItem, ActivityLog + associations
├── middleware/
│   └── authMiddleware.js       # Vérification du JWT (protect), peuple req.userId
├── controllers/
│   ├── authController.js       # Inscription, connexion, récupération de mot de passe
│   ├── vaultController.js      # CRUD des items du coffre chiffré
│   └── activityController.js   # Journal d'activité du compte
├── routes/
│   ├── authRoutes.js
│   ├── vaultRoutes.js
│   └── activityRoutes.js
├── utils/
│   ├── activityLogger.js       # Écriture best-effort dans le journal d'activité
│   └── mailer.js                # Envoi d'email de réinitialisation (SendGrid)
├── package.json
└── Dockerfile
```

> Note : `package.json` et le `Dockerfile` vivent dans `src/`, qui est le répertoire de travail réel du projet (voir [Installation](#-installation) et [Déploiement](#-déploiement)).

## 📦 Installation

### Prérequis
- **Node.js** v20+
- Une instance **PostgreSQL** accessible

### Dépendances

```bash
cd src
npm install
```

## ⚙️ Variables d'environnement

Créez un fichier `.env` dans `src/` :

```dotenv
# --- PostgreSQL ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swordmanager
DB_USER=admin
DB_PASS=admin

# --- Sécurité & serveur ---
JWT_SECRET=une_cle_tres_longue_et_aleatoire
PORT=8080

# --- Email (récupération de mot de passe, via SendGrid) ---
# Optionnel en local : si absente, le lien de réinitialisation est simplement
# affiché dans les logs du serveur au lieu d'être envoyé par email.
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=no-reply@swordmanager.cloud
FRONTEND_URL=http://localhost:5500
```

| Variable | Requise | Description |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | ✅ | Connexion PostgreSQL |
| `JWT_SECRET` | ✅ | Secret de signature des JWT |
| `PORT` | — | Port d'écoute (défaut `8080`) |
| `SENDGRID_API_KEY` | — | Si absente, les liens de reset sont loggés en console au lieu d'être envoyés |
| `SENDGRID_FROM_EMAIL` | — | Adresse d'expédition des emails |
| `FRONTEND_URL` | — | Base URL utilisée pour construire les liens de réinitialisation |
| `NODE_ENV` | — | `production` active CORS strict, désactive le SQL logging, désactive `dotenv` |

## 🚀 Lancement

```bash
cd src
npm start          # démarre le serveur (node index.js)
npm run format      # formate le code avec Prettier
npm run format:check
```

Au démarrage, le serveur vérifie la connexion PostgreSQL puis synchronise les modèles (`sequelize.sync()`, pas de migrations à exécuter séparément).

## 📖 Documentation de l'API

Toutes les routes protégées (🔒) attendent un header `Authorization: Bearer <token>`.

### `POST /auth/register`
Crée un compte. Corps : `{ email, password, protectedKey }` (`password` = `authHash` dérivé côté client, jamais le mot de passe en clair). → `201 { id, email }`

### `POST /auth/login`
Corps : `{ email, password }`. → `200 { token, protectedKey }`. Message générique identique en cas d'email ou mot de passe invalide (anti-énumération).

### `POST /auth/password-reset/request`
Corps : `{ email }`. Limité à 5 req/15min/IP. Envoie un email avec un lien de réinitialisation (30 min de validité) si le compte existe. Répond **toujours** avec le même message générique, que le compte existe ou non.

### `GET /auth/password-reset/recovery-key?email=&token=`
Valide le token de reset et renvoie `{ hasRecoveryKey, recoveryProtectedKey }` pour permettre au client de déchiffrer localement la clé du coffre.

### `POST /auth/password-reset/complete`
Corps : `{ email, token, password, protectedKey }`. Finalise la réinitialisation : le client a déjà démontré la possession de la clé de récupération en re-chiffrant `protectedKey` localement ; cet endpoint ne fait que persister le nouveau `passwordHash` et `protectedKey`, et invalide le token.

### `POST /auth/recovery-key` 🔒
Corps : `{ recoveryProtectedKey }`. Enregistre ou remplace la clé de récupération de l'utilisateur connecté (génération initiale ou régénération).

### `GET /vault` 🔒
Liste les items du coffre de l'utilisateur, triés par `updatedAt` décroissant.

### `POST /vault` 🔒
Corps : `{ type, label, encryptedData, folder }`. Crée un item chiffré (ou un dossier, représenté par un item placeholder préfixé `[Dossier Vide] `).

### `PUT /vault/:id` 🔒
Corps : `{ type, label, encryptedData, folder }`. Remplace un item existant appartenant à l'utilisateur. Un changement de dossier est distingué d'une simple modification dans le journal d'activité.

### `DELETE /vault/:id` 🔒
Supprime un item appartenant à l'utilisateur.

### `GET /activity` 🔒
Renvoie les 100 dernières entrées du journal d'activité de l'utilisateur, triées par date décroissante.

### `POST /activity` 🔒
Corps : `{ action, detail? }`. Enregistre un événement dont l'origine est purement client (`password_copied`, `password_revealed`, `logout`, `logout_auto`) — les autres actions (`login`, opérations sur le coffre, réinitialisation) sont déjà loggées automatiquement par leurs endpoints respectifs.

## 🔒 Sécurité

- **`helmet`** : en-têtes HTTP de sécurité par défaut.
- **CORS strict** : origines autorisées limitées explicitement (`www.swordmanager.cloud` en prod, `localhost:5500` en dev).
- **Rate limiting global** : 100 req/15min/IP, et 5 req/15min/IP sur la demande de réinitialisation de mot de passe (route sensible car elle déclenche un envoi d'email).
- **`trust proxy: 1`** : ne fait confiance qu'au premier hop (le proxy Cloud Run), pour que l'IP réelle du client soit correctement extraite sans permettre à un client d'usurper son IP via `X-Forwarded-For` (`trust proxy: true` casse volontairement `express-rate-limit`, qui refuse de démarrer dans cette configuration).
- **Mots de passe** : jamais stockés ni transmis en clair — le serveur ne reçoit que l'`authHash` dérivé côté client, lui-même haché avec Argon2id avant stockage.
- **Tokens de réinitialisation** : seul le hash SHA-256 du token est stocké (jamais le token brut), comparaison en temps constant (`crypto.timingSafeEqual`), expiration 30 minutes, à usage unique.
- **Anti-énumération** : réponses identiques pour un compte existant ou non sur `/auth/login` et `/auth/password-reset/request`.
- **Journal d'activité** : best-effort — un échec d'écriture du log n'interrompt jamais la requête principale.

## 🚢 Déploiement

Déploiement continu vers **Google Cloud Run** via GitHub Actions ([.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)), déclenché sur push vers `main` lorsqu'un fichier sous `src/` change. Le workflow construit l'image Docker (`src/Dockerfile`, build multi-stage Node 20 slim), la pousse vers Artifact Registry, puis déploie sur Cloud Run.
