# Mission 2 — Outlook (Microsoft Graph) + webhook WordPress

**Objectif de sortie** : chaque AE voit ses **vrais RDV du jour** dans son
Dashboard (au lieu du panneau vide de la mission 1), rattachés
automatiquement aux comptes/oppos par email des participants. Les
formulaires du site WordPress créent automatiquement des prospects dans
le CRM.

**Durée attendue** : 2 à 4 sessions Claude Code (soirées).

**Pré-requis** : mission 1 déployée et validée (J1 à J5 de `MISSION-1.md`
cochés).

---

## Prérequis — à faire par Pierre AVANT la session 1 (~20 min)

Ces étapes prolongent le point 4 de `PREREQUIS.md` (App Registration
Entra ID `auum-crm`), qu'il faut maintenant finaliser :

- [ ] Dans le portail Azure → **App registrations → auum-crm → API
      permissions** : ajouter la permission **Microsoft Graph → Delegated
      → Calendars.Read**
- [ ] Cliquer **Grant admin consent** pour le tenant auum (nécessaire si
      les AE n'ont pas individuellement le droit de consentir)
- [ ] Dans **Supabase → Authentication → Providers → Azure** : vérifier
      que le provider est activé avec le Client ID / Tenant ID / Secret
      de cette App Registration
- [ ] Dans **Supabase → Authentication → URL Configuration** : ajouter
      `https://auum-crm.vercel.app/**` aux Redirect URLs si ce n'est pas
      déjà fait
- [ ] Côté WordPress : identifier comment déclencher un webhook sortant
      à la soumission d'un formulaire (plugin **WPForms**, **Contact
      Form 7 + hook**, ou **Webhooks CF7**) — **pas urgent**, ce point est
      traité en dernier dans cette mission (voir plus bas)

## Le prompt à coller dans Claude Code (session 1)

> Lis MISSION-2.md et le code de la mission 1 (déjà en prod) pour
> comprendre l'état actuel. Mission 2, étape par étape, en t'arrêtant
> pour me faire valider chaque jalon :
>
> 1. **Auth Microsoft** : ajoute un bouton « Se connecter avec Microsoft »
>    sur l'écran de login (en plus d'email/mdp), demandant le scope
>    `Calendars.Read` en plus des scopes par défaut. Vérifie que
>    `provider_token` / `provider_refresh_token` sont bien récupérés
>    après connexion et stockés côté serveur (jamais exposés au client).
> 2. **Synchronisation calendrier** : un bouton « Synchroniser mon
>    calendrier » sur le Dashboard AE déclenche un appel serveur à
>    Microsoft Graph (`/me/calendarview` pour aujourd'hui), upsert dans
>    `meetings` (dédoublonnage par `graph_id`, unique). Rattachement
>    automatique à `opp_id`/`entity_id` par email des participants
>    (contacts.email, puis domaine → entities).
> 3. **Déploiement Outlook** : variables d'environnement supplémentaires
>    sur Vercel si besoin, push + vérification en prod. On s'arrête là
>    pour valider les jalons J1 à J3 avant de passer au webhook.
> 4. **Webhook WordPress** (dernier, traité seulement une fois le reste
>    validé) : crée une route API (`/api/webhooks/wordpress`) qui reçoit
>    les soumissions de formulaire (POST JSON), authentifiée par un
>    secret partagé en en-tête, et crée un enregistrement dans
>    `prospects` (source = « Site web »). Rejette toute requête sans le
>    bon secret.
>
> Contraintes : pas de cron/tâche planifiée dans cette mission (la sync
> reste déclenchée manuellement par l'AE) — on l'automatisera plus tard
> si le besoin se confirme. Le token Microsoft ne doit jamais transiter
> côté client. Rien de `demo:true`. Commits atomiques.
>
> **Priorité : traite le webhook WordPress en dernier**, après avoir
> validé toute la partie Outlook (jalons J1 à J3) — ce n'est pas urgent
> pour Pierre.

---

## Jalons de validation (à cocher toi-même)

- [ ] **J1** — Je me connecte avec mon compte Microsoft auum, ça marche
- [ ] **J2** — Je clique « Synchroniser mon calendrier », mes vrais RDV du
      jour apparaissent dans mon Dashboard
- [ ] **J3** — Un RDV avec un contact connu du CRM (même domaine email
      qu'un compte) est bien rattaché au compte/à l'oppo correspondante
- [ ] **J4** — Resynchroniser deux fois de suite ne crée pas de doublons
- [ ] **J5** *(dernier, webhook WordPress — pas urgent)* — Je soumets le
      formulaire de contact sur auum.fr (ou un test simulé), un nouveau
      prospect apparaît dans la base (table `prospects` — l'écran
      « Mes prospects » viendra en mission 3)

## Critère de décision (fin de mission 2)

Si les 5 jalons passent → on enchaîne la mission 3 (connecteurs
Basile/Emelia/Lemlist + workflow validation BDD, écran « Mes prospects »).
Sinon → on documente ce qui bloque (souvent : droits Azure/tenant) avant
de continuer.
