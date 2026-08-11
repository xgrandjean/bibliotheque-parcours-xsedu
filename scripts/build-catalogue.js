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
    const chapitres = (json.root.children && json.root.children.listeChapitres) || [];
    const totalQuestions = chapitres.reduce((sum, c) => {
        const questions = (c.children && c.children.listeQuestions) || [];
        return sum + (Array.isArray(questions) ? questions.length : 0);
    }, 0);

    return {
        slug: fileName.replace(/\.json$/, ''),
        designation: row.designation || '',
        matiere: row.matiere || '',
        niveau: row.niveau || '',
        classe: row.classe || '',
        theme: row.theme || '',
        numero: row.numero || '',
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
