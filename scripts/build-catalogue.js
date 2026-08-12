#!/usr/bin/env node
// Régénère catalogue.json à partir de tous les fichiers parcours/*.json.
// Exécuté automatiquement après chaque merge sur main — jamais édité à la main.

const fs = require('fs');
const path = require('path');

const PARCOURS_DIR = path.join(__dirname, '..', 'parcours');
const OUTPUT_FILE = path.join(__dirname, '..', 'catalogue.json');

function readParcoursFiles() {
    if (!fs.existsSync(PARCOURS_DIR)) return [];
    return fs.readdirSync(PARCOURS_DIR).filter(f => f.endsWith('.json'));
}

function buildEntry(fileName) {
    const filePath = path.join(PARCOURS_DIR, fileName);
    let json;
    try {
        json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.warn(`⚠️ ${fileName} ignoré (JSON invalide) : ${e.message}`);
        return null;
    }

    if (json.xsproHierarchicalExport !== true || json.type !== 'listeParcours' || !json.root || !json.root.row) {
        console.warn(`⚠️ ${fileName} ignoré (format non conforme)`);
        return null;
    }

    const row = json.root.row;
    const meta = json.metaBibliotheque || {};
    const chapitres = (json.root.children && json.root.children.listeChapitres) || [];
    const totalQuestions = chapitres.reduce((sum, c) => {
        const questions = (c.children && c.children.listeQuestions) || [];
        return sum + (Array.isArray(questions) ? questions.length : 0);
    }, 0);

    return {
        slug: fileName.replace(/\.json$/, ''),
        designation: row.designation || '',
        // Matière(s)/niveau(x) de classe : saisis manuellement par le contributeur
        // (metaBibliotheque, tableaux — un parcours peut en avoir plusieurs), jamais lus
        // sur le parcours lui-même — voir validate-pr.js et README.md.
        matieres: Array.isArray(meta.matieres) ? meta.matieres.filter(Boolean) : [],
        niveauxClasse: Array.isArray(meta.niveauxClasse) ? meta.niveauxClasse.filter(Boolean) : [],
        theme: row.theme || '',
        // "Observations" du parcours : volontairement visible publiquement (voir README.md) —
        // aide un enseignant à juger de l'intérêt du parcours avant de l'importer.
        observation: row.commentaire || '',
        nbChapitres: chapitres.length,
        nbQuestions: totalQuestions,
        contributedBy: json.contributedBy || null,
        contributedAt: json.contributedAt || null,
    };
}

const entries = readParcoursFiles()
    .map(buildEntry)
    .filter(Boolean)
    .sort((a, b) => a.designation.localeCompare(b.designation));

const catalogue = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    parcours: entries,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`catalogue.json régénéré — ${entries.length} parcours.`);
