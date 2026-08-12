# Bibliothèque partagée de parcours XSpro/XSedu

Dépôt communautaire : les enseignants publient des parcours de formation via
pull request, l'application XSpro/XSedu les récupère via ce dépôt.

## Structure

```
parcours/
  <slug>.json        ← un fichier par parcours (export hiérarchique XSpro)
catalogue.json        ← généré automatiquement, ne jamais éditer à la main
scripts/
  validate-pr.js       ← validation automatique des PR (voir workflow associé)
  build-catalogue.js    ← régénération du catalogue après chaque merge
.github/workflows/
  validate-pr.yml       ← check obligatoire avant merge
  build-catalogue.yml    ← régénère catalogue.json au push sur main
```

### Format d'un fichier `parcours/<slug>.json`

C'est exactement le format d'export hiérarchique produit par XSpro (menu
"Exporter le parcours complet"), avec deux champs ajoutés par l'application
au moment de la publication :

```json
{
  "xsproHierarchicalExport": true,
  "version": 1,
  "type": "listeParcours",
  "contributedBy": "login-github-du-contributeur",
  "contributedAt": "2026-01-15T10:00:00.000Z",
  "metaBibliotheque": { "matieres": ["NSI", "Mathématiques"], "niveauxClasse": ["Première", "Terminale"] },
  "root": {
    "table": "listeParcours",
    "row": { "designation": "...", "statut": 2, "theme": "...", "commentaire": "...", ... },
    "children": {
      "listeChapitres": [
        { "row": {...}, "children": { "listeQuestions": [...] } }
      ]
    }
  }
}
```

Le bloc `metaBibliotheque` (une ou plusieurs matières / niveaux de classe) est
saisi manuellement par le contributeur au moment de la publication,
indépendamment des champs du parcours : `root.row.matiere` y est en pratique
presque toujours vide, et `root.row.niveau` y est une note de difficulté, pas
un niveau scolaire. Un parcours interdisciplinaire ou utilisable à plusieurs
niveaux peut avoir plusieurs valeurs dans `matieres`/`niveauxClasse`.

Les champs `enseignant`/`etablissement` sont vidés côté application avant
publication (vie privée) — seul `contributedBy` (pseudo GitHub) identifie
l'auteur. En revanche `root.row.commentaire` (les « Observations » du
parcours) reste **volontairement public** : c'est une description de
contenu qui aide un autre enseignant à juger de l'intérêt du parcours avant
de l'importer (affiché sur les cartes de l'onglet « Parcourir »). Seuls les
parcours à l'état Validé (`root.row.statut === 2`) sont acceptés.

## Mise en place (à faire une seule fois, par l'éditeur XSpro)

1. Créer un nouveau dépôt GitHub **public** (le catalogue doit être lisible
   anonymement via `raw.githubusercontent.com`).
2. Copier le contenu de ce dossier (`.github/`, `scripts/`) à la racine du
   nouveau dépôt, créer un dossier `parcours/` vide avec un `.gitkeep`.
3. **Paramètres du dépôt → Règles de branche (`main`)** :
   - Exiger que le check `validate` (workflow `Valider une contribution`)
     passe avant de pouvoir fusionner une PR.
   - Ne PAS exiger de revue obligatoire techniquement si vous êtes seul
     mainteneur, mais **ne fusionnez jamais sans lire le contenu vous-même** —
     la validation automatique n'est qu'un filtre de forme (JSON valide,
     champs présents, motifs `<script>` grossiers), pas une garantie de
     contenu approprié.
4. **Paramètres du dépôt → Actions → General → Workflow permissions** :
   activer "Read and write permissions" (nécessaire pour que
   `build-catalogue.yml` puisse committer `catalogue.json`).
5. Renseigner le nom du dépôt (`owner/repo`) dans `src/globals.js` côté
   application XSpro (`BIBLIOTHEQUE_PARCOURS_OWNER` / `BIBLIOTHEQUE_PARCOURS_REPO`).

## Modération

- Toute contribution (nouvelle publication, mise à jour, retrait) arrive comme
  une pull request depuis le fork du contributeur — jamais en écriture directe
  sur `main`.
- Le check automatique (`validate-pr.js`) rejette les fichiers malformés, trop
  gros (> 2 Mo), incomplets, ou contenant des motifs manifestement dangereux
  (`<script>`, gestionnaires `on...=`, liens `javascript:`). Ce n'est qu'un
  premier filtre — **le merge reste une décision humaine**.
- `catalogue.json` n'est jamais modifié dans une PR : il est entièrement
  régénéré par `build-catalogue.yml` après chaque merge, ce qui évite les
  conflits entre contributions simultanées.

## Suppression et historique Git

Retirer un parcours (PR de suppression du fichier `parcours/<slug>.json`) le
fait disparaître du catalogue et des futures récupérations, mais **ne l'efface
pas de l'historique Git** — un ancien commit reste consultable indéfiniment.
Ne présentez jamais cette action aux enseignants comme une suppression
définitive.
