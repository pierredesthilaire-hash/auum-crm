# Mission 3 — Prospection : connecteurs Basile/Emelia + workflow BDD

**Objectif de sortie** : un AE peut demander une base de prospects ciblée
(secteur, localisation, effectif, fonctions) directement depuis le CRM,
trier les personas trouvés, la faire valider par la direction, puis
recevoir les contacts enrichis (email + téléphone) comme prospects — avec
un écran « Mes prospects » pour les travailler (touches, statuts,
conversion en opportunité).

**Durée attendue** : 3 à 5 sessions Claude Code (soirées).

**Pré-requis** : mission 1 déployée. Mission 2 (Outlook) peut être encore
en pause — les deux sont indépendantes.

---

## Prérequis — à faire par Pierre AVANT la session 1 (~15 min)

- [ ] Créer un compte / récupérer une clé API **Basile** (api.basile.cc)
      — recherche d'entreprises et de contacts B2B français
- [ ] Créer un compte / récupérer une clé API **Emelia** — enrichissement
      email nominatif + téléphone portable des contacts retenus
- [ ] Noter les deux clés (gestionnaire de mots de passe) — je les
      placerai dans `.env.local`, jamais dans le code

## Le prompt à coller dans Claude Code (session 1)

> Lis MISSION-3.md, et relis `db/schema.sql` (tables `prospects`,
> `touches`, `bdd_requests` déjà prêtes depuis la mission 1, encore
> vides). Le prototype fait foi pour le comportement exact du workflow
> BDD (recherche → tri → validation → enrichissement) : section
> "Demandes de génération de BDD" et "Prospection". Mission 3, étape par
> étape, en t'arrêtant pour me faire valider chaque jalon :
>
> 1. **Demande de génération** : formulaire (outil, nb de contacts visé,
>    NAF/secteur, localisation, effectif min/max, fonctions ciblées,
>    justification, mode d'enrichissement) → appelle l'API **Basile**
>    côté serveur pour lister des personas (société, contact, fonction,
>    ville, LinkedIn) **sans** enrichissement — juste le comptage/la
>    recherche, qui coûte peu cher. Détecte les doublons contre la base
>    CRM existante (comptes/prospects déjà connus).
> 2. **Tri des personas** : l'AE coche/décoche les personas à conserver
>    (boutons « tout garder », « tout écarter », « écarter hors cible &
>    doublons »), puis soumet à validation (`bdd_requests.status` :
>    review → pending).
> 3. **Validation direction** : écran listant les demandes en attente,
>    la direction valide ou refuse (avec commentaire), visible pour
>    l'instant sur le Cockpit ou un nouvel onglet dédié — à toi de
>    proposer l'emplacement le plus cohérent avec l'existant.
> 4. **Enrichissement** : une fois validée, appel serveur à l'API
>    **Emelia** pour enrichir uniquement les contacts conservés (email
>    et/ou téléphone selon le mode demandé), création des lignes
>    `prospects` correspondantes (`bdd_requests.status` → imported).
> 5. **Écran Mes prospects** : table filtrable (AE, statut), traçage de
>    contact (✉️ email / 📞 tél → `touches`), changement de statut,
>    conversion en opportunité (crée le compte si absent, oppo en
>    qualification, source = « Outbound/Prospection »).
>
> Contraintes : les clés API Basile/Emelia restent strictement côté
> serveur (jamais exposées au client). La recherche (étape 1) ne doit
> jamais appeler Emelia — l'enrichissement (étape 4) est le seul point
> qui consomme des crédits coûteux, c'est tout l'intérêt du tri
> intermédiaire. Rien de `demo:true`. Commits atomiques.
>
> Hors périmètre pour cette mission (à voir plus tard) : connecteur
> Lemlist et campagnes outbound (table `campaigns`, déjà prête mais pas
> utilisée ici), répartition automatique des prospects non affectés par
> segment, import Excel/CSV en masse.

---

## Jalons de validation (à cocher toi-même)

- [ ] **J1** — Je lance une recherche ciblée (ex. NAF + localisation +
      effectif), une liste de vrais personas apparaît en quelques
      secondes, sans email ni téléphone
- [ ] **J2** — Je trie (décoche des personas hors cible), je soumets —
      la demande passe en attente de validation
- [ ] **J3** — Connecté en direction, je vois la demande, je la valide
      avec un commentaire
- [ ] **J4** — L'enrichissement se déclenche, les contacts conservés
      apparaissent dans « Mes prospects » avec un vrai email/téléphone
- [ ] **J5** — Je trace un appel sur un prospect, je le convertis en
      opportunité : le compte et l'oppo sont créés correctement

## Critère de décision (fin de mission 3)

Si les 5 jalons passent → on peut enchaîner sur Lemlist/campagnes
outbound (mission 3b) ou sur la mission 4 (couche IA). Sinon → on
documente ce qui bloque (souvent : format de réponse de l'API Basile à
ajuster, ou quotas/crédits).
