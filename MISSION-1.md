# Mission 1 — Fondations (base + auth + écrans cœur)

**Objectif de sortie** : une URL Vercel où les 5 utilisateurs se connectent et
travaillent sur les vraies données — Pipe (kanban), Comptes, Dashboard AE,
avec journal d'audit. Le reste (prospection, outbound, IA) vient en mission 2+.

**Durée attendue** : 3 à 5 sessions Claude Code (soirées).

---

## Le prompt à coller dans Claude Code (session 1)

> Lis README.md, PREREQUIS.md, db/schema.sql et ouvre
> prototype/auum-crm-prototype.html pour comprendre le produit (c'est la spec).
>
> Mission 1, étape par étape, en t'arrêtant pour me faire valider chaque jalon :
>
> 1. **Init** : crée une app Next.js (App Router, TypeScript) avec Supabase
>    (`@supabase/supabase-js` + `@supabase/ssr`). Configure `.env.local`
>    (je te donnerai les clés, ne les écris jamais dans le code).
> 2. **Base** : applique `db/schema.sql` sur mon projet Supabase (génère la
>    migration, je l'exécute ou tu me guides). Ajoute les policies RLS :
>    direction = tout, AE = ses lignes.
> 3. **Import** : écris `scripts/import-seed.ts` qui charge `data/seed.json`
>    dans les tables (groups → entities → contacts → opportunities → tasks →
>    audit, settings avec benchmarks/segConfig/segOwners). Mappe les AE vers
>    des profils. EXCLUS tout enregistrement `demo: true` derrière un flag
>    `--with-demo` (par défaut : sans).
> 4. **Auth** : login Supabase (email/mdp pour commencer, provider Azure quand
>    j'aurai les accès IT). Crée les 5 profils : Pierre (direction), Léo,
>    Mathieu, Wandrille, Steve (ae).
> 5. **Écrans**, dans cet ordre, en reprenant le design du prototype
>    (sidebar vert sapin, Space Grotesk/Inter, mêmes couleurs d'étapes) :
>    a. **Pipe** : kanban 5 étapes, drag & drop avec modale de confirmation
>       (+ commentaire, alerte si recul), fiche oppo en drawer, création,
>       gagné/perdu avec bascule parc. Chaque action écrit dans audit_log.
>    b. **Mes clients** : grille de cartes (segment, parc, pipe, actu), fiche
>       en drawer (rattachement groupe, effectif/segment, contacts, oppos).
>    c. **Dashboard AE** : KPIs, RDV du jour (table meetings, vide pour
>       l'instant), tâches triées par urgence avec ✓ Fait et ＋ Tâche,
>       règles auto (aging/late/nodate) exécutées côté serveur.
>    d. **Cockpit direction** : KPIs, funnel, pipe par AE, pondération
>       lifecycle (settings.benchmarks), vieillissantes, journal.
> 6. **Déploiement** : push GitHub + déploiement Vercel. Donne-moi l'URL.
>
> Contraintes : français partout, montants en k€, l'unité métier est la
> machine. Rien de `demo:true` en prod. Commits atomiques avec messages clairs.

---

## Jalons de validation (à cocher toi-même)

- [ ] **J1** — Je me connecte sur l'URL Vercel avec mon compte
- [ ] **J2** — Je vois les 225 oppos réelles dans le kanban, je déplace une
      carte, la confirmation s'affiche, le journal enregistre
- [ ] **J3** — Connecté en tant que Léo, je ne vois QUE le périmètre de Léo
- [ ] **J4** — Je gagne une oppo test : le parc du compte s'incrémente
- [ ] **J5** — Le dashboard de Wandrille affiche ses tâches auto (vieillissantes)

## Critère de décision (fin de mission 1)

Si les 5 jalons passent en ≤ 2 semaines de soirées → le modèle binôme est
validé, on enchaîne la mission 2 (Outlook).
Sinon → on documente ce qui bloque et on ressort le devis HubSpot, sans regret :
le prototype et ce kit auront servi de levier de négociation.
