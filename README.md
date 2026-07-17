# CRM auum — Industrialisation

Ce dépôt contient le kit de démarrage pour transformer le prototype CRM auum
(validé par l'équipe commerciale) en application de production.

## Contexte en 30 secondes

auum (machines de nettoyage sans eau) migre hors de Microsoft Dynamics vers un
CRM sur mesure. Un **prototype complet et fonctionnel** existe dans
`prototype/auum-crm-prototype.html` : il fait office de **spécification
exécutable**. Toute question du type « comment doit se comporter X ? » trouve sa
réponse en ouvrant ce fichier dans un navigateur (comptes de démo : `psaint` /
`lconsigny` / `mespiard` / `wernault` / `scustos`, mot de passe `auum`).

## Architecture cible

| Couche      | Choix                    | Pourquoi |
|-------------|--------------------------|----------|
| Base        | **Supabase** (PostgreSQL)| Auth intégrée, RLS, API instantanée, gratuit pour démarrer |
| Auth        | Supabase Auth → provider **Azure (Entra ID)** | Les AE se connectent avec leur compte Microsoft existant |
| Front       | **Next.js** (App Router) | Déploiement Vercel en un clic, écosystème mature |
| Hébergement | **Vercel** (front) + Supabase (données) | ~0-50 €/mois au début |
| Emails/RDV  | Microsoft Graph (mission 2) | Écosystème Microsoft déjà en place chez auum |

> Alternative full-Azure possible plus tard si la DSI l'exige ; commencer par
> Supabase+Vercel pour la vitesse.

## Contenu du kit

- `db/schema.sql` — schéma PostgreSQL complet, aligné sur le prototype
- `data/seed.json` — données réelles (225 oppos du pipe France, 187 comptes,
  groupes mère/filiales) + données de démonstration marquées `demo: true`
- `prototype/auum-crm-prototype.html` — la référence fonctionnelle
- `PREREQUIS.md` — ce que l'humain doit faire AVANT la première session
- `MISSION-1.md` — le brief exact de la première session Claude Code

## Règles du projet

1. **Le prototype fait foi** pour le comportement métier (validation d'étape,
   pondération lifecycle, workflow BDD, périmètres par segment…).
2. **Purger le démo avant la prod** : tout enregistrement `demo: true`
   (prospects fictifs, actus, RDV, tâches T-90xx) ne doit jamais atteindre la
   base de production finale.
3. **Chaque modification métier est journalisée** dans `audit_log` — c'est une
   exigence direction, pas un nice-to-have.
4. **Jamais de secret dans le code** : clés API et connexions en variables
   d'environnement (`.env.local`, jamais commité).
5. Français partout dans l'interface. Montants en €, unité métier = la machine.

## Feuille de route

- **Mission 1** ✅ déployée (`https://auum-crm.vercel.app`) : base + auth +
  import + écrans Pipe/Comptes/Dashboard/Cockpit — voir `MISSION-1.md`
- **Mission 2** (en cours) : synchro Outlook (Microsoft Graph) + webhook
  WordPress — voir `MISSION-2.md`
- **Mission 3** : connecteurs Basile/Emelia/Lemlist + workflow validation BDD
- **Mission 4** : couche IA (signaux, veille, assistant email) + Claap
