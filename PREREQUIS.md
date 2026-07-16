# Prérequis — à faire par Pierre AVANT la session 1 (~45 min)

Ces étapes demandent des créations de comptes et des validations que seul un
humain peut faire. Une fois cochées, Claude Code fait le reste.

## 1. Postes de travail (~15 min)
- [ ] Installer **Node.js** (version LTS) : https://nodejs.org
- [ ] Installer **Git** : https://git-scm.com
- [ ] Installer **Claude Code** (app desktop ou `npm install -g @anthropic-ai/claude-code`)
- [ ] Créer un compte **GitHub** (si pas déjà) et un dépôt privé `auum-crm`
- [ ] Y pousser le contenu de ce kit (ou glisser le dossier dans Claude Code)

## 2. Supabase (~10 min)
- [ ] Créer un compte sur https://supabase.com (gratuit)
- [ ] Créer un projet `auum-crm` (région : **Europe West — Paris ou Francfort**,
      important pour le RGPD)
- [ ] Noter dans un gestionnaire de mots de passe :
      - `SUPABASE_URL` (Settings → API)
      - `SUPABASE_ANON_KEY` (Settings → API)
      - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API — NE JAMAIS l'exposer côté client)
      - le mot de passe de la base (Settings → Database)

## 3. Vercel (~5 min)
- [ ] Créer un compte sur https://vercel.com (gratuit) avec le compte GitHub
- [ ] Rien d'autre — le déploiement se fera depuis Claude Code

## 4. Entra ID / Microsoft (~15 min, peut attendre la fin de mission 1)
- [ ] Dans le portail Azure de auum : Entra ID → App registrations →
      **New registration** → nom `auum-crm`
- [ ] Redirect URI (type Web) : `https://<PROJET>.supabase.co/auth/v1/callback`
      (l'URL exacte est donnée par Supabase → Authentication → Providers → Azure)
- [ ] Créer un **client secret** et noter : Application (client) ID,
      Directory (tenant) ID, secret
- [ ] Les renseigner dans Supabase → Authentication → Providers → **Azure**
- ⚠️ Si tu n'as pas les droits admin sur le tenant Microsoft d'auum, prévois
      la demande à l'IT maintenant : c'est le seul point de dépendance externe.
      En attendant, la mission 1 fonctionne avec l'auth email/mot de passe Supabase.

## 5. Données
- [ ] Vérifier que `data/seed.json` est bien dans le dépôt
- [ ] Exporter depuis Dynamics (si pas déjà fait) : la **base clients complète**
      (comptes + contacts + parc) pour compléter l'import — le pipe y est déjà.

## Ce qu'il ne faut PAS faire
- Ne mets **aucune clé** dans un fichier commité. Claude Code te demandera de
  les placer dans `.env.local`.
- Ne branche pas la production Dynamics : on travaille sur des exports.
