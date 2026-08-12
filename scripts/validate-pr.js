#!/usr/bin/env node
// Valide les fichiers parcours/*.json touchés par une pull request avant revue
// humaine. Filtre automatique, PAS une garantie de sécurité totale : le merge
// reste une décision humaine.
//
// Usage (dans le workflow) : node scripts/validate-pr.js <fichier1> <fichier2> ...

const fs = require('fs');

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo
const DANGEROUS_PATTERNS = [/<script/i, /on\w+\s*=/i, /javascript:/i];
const SLUG_PATTERN = /^parcours\/[a-z0-9-]+\.json$/;

let hasError = false;

function fail(file, message) {
    hasError = true;
    console.error(`❌ ${file} — ${message}`);
}

function ok(file, message) {
    console.log(`✅ ${file} — ${message}`);
}

const files = process.argv.slice(2).filter(f => f.startsWith('parcours/') && f.endsWith('.json'));

if (files.length === 0) {
    console.log('Aucun fichier parcours/*.json modifié par cette PR — rien à valider.');
    process.exit(0);
}

for (const file of files) {
    if (!SLUG_PATTERN.test(file)) {
        fail(file, `nom de fichier non conforme (attendu: parcours/<slug-en-minuscules>.json)`);
        continue;
    }

    if (!fs.existsSync(file)) {
        // Fichier supprimé par la PR (retrait d'un parcours) — rien à valider.
        ok(file, 'suppression — pas de validation de contenu nécessaire');
        continue;
    }

    const stat = fs.statSync(file);
    if (stat.size > MAX_SIZE_BYTES) {
        fail(file, `taille ${(stat.size / 1024 / 1024).toFixed(2)} Mo dépasse la limite de 2 Mo`);
        continue;
    }

    const raw = fs.readFileSync(file, 'utf8');

    let json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        fail(file, `JSON invalide : ${e.message}`);
        continue;
    }

    if (json.xsproHierarchicalExport !== true) {
        fail(file, 'champ "xsproHierarchicalExport" absent ou différent de true — ce n\'est pas un export XSpro valide');
        continue;
    }
    if (json.type !== 'listeParcours') {
        fail(file, `champ "type" = "${json.type}", attendu "listeParcours"`);
        continue;
    }
    if (!json.root || !json.root.row) {
        fail(file, 'champ "root.row" manquant');
        continue;
    }

    const row = json.root.row;
    if (!row.designation || !String(row.designation).trim()) {
        fail(file, 'champ "root.row.designation" manquant ou vide');
        continue;
    }
    // Seuls les parcours à l'état "Validé" (statut=2 côté XSpro) sont publiables —
    // un brouillon n'offre aucune garantie de contenu stable.
    if (parseInt(row.statut, 10) !== 2) {
        fail(file, `champ "root.row.statut" = ${row.statut}, attendu 2 (Validé)`);
        continue;
    }
    // La matière et le niveau de classe ne viennent PAS du parcours lui-même (matiere y
    // est en pratique toujours vide, niveau y est une note de difficulté et non un
    // niveau scolaire) : ils sont saisis manuellement par le contributeur au moment de
    // publier, dans metaBibliotheque — voir README.md.
    const meta = json.metaBibliotheque || {};
    if (!meta.matiere || !String(meta.matiere).trim()) {
        fail(file, 'champ "metaBibliotheque.matiere" manquant ou vide');
        continue;
    }
    if (!meta.niveauClasse || !String(meta.niveauClasse).trim()) {
        fail(file, 'champ "metaBibliotheque.niveauClasse" manquant ou vide');
        continue;
    }
    if (!json.contributedBy) {
        fail(file, 'champ "contributedBy" manquant (pseudo GitHub du contributeur)');
        continue;
    }

    const chapitres = (json.root.children && json.root.children.listeChapitres) || [];
    if (!Array.isArray(chapitres) || chapitres.length === 0) {
        fail(file, 'aucun chapitre — le parcours doit contenir au moins un chapitre');
        continue;
    }
    const auMoinsUneQuestion = chapitres.some(c => {
        const questions = (c.children && c.children.listeQuestions) || [];
        return Array.isArray(questions) && questions.length > 0;
    });
    if (!auMoinsUneQuestion) {
        fail(file, 'aucune question/cours dans aucun chapitre');
        continue;
    }

    let hasDangerousPattern = false;
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(raw)) {
            fail(file, `motif potentiellement dangereux détecté (${pattern}) — vérification manuelle requise avant merge`);
            hasDangerousPattern = true;
            break;
        }
    }
    if (hasDangerousPattern) continue;

    ok(file, `parcours "${row.designation}" (${meta.matiere} · ${meta.niveauClasse}) — ${chapitres.length} chapitre(s), contribué par @${json.contributedBy}`);
}

if (hasError) {
    console.error('\nValidation échouée — corrigez les points ci-dessus. Le merge reste ensuite une décision humaine, cette validation automatique n\'est qu\'un premier filtre.');
    process.exit(1);
}

console.log('\nValidation automatique réussie. Une revue humaine reste nécessaire avant de fusionner.');
