const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('xiquim.db');

const produtos = db.prepare('SELECT id, nome, imagem_url FROM produtos').all();
const imageDir = path.join(__dirname, 'descriçoes corretas');
const images = fs.readdirSync(imageDir).filter(f => f.endsWith('.jpg'));

// Simple string normalization for comparison
function normalize(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

const mappings = [];
let unmatchedImages = [];

images.forEach(img => {
    const desc = img.replace(/\.jpg$/i, '');
    const normDesc = normalize(desc);

    // Find best match in DB
    let bestMatch = null;
    let bestScore = -1;

    for (let p of produtos) {
        const normDb = normalize(p.nome);
        // Jaccard similarity or simple inclusion
        // let's do a simple word match score
        const wordsA = normDesc.match(/[a-z0-9]+/g) || [];
        const wordsB = normDb.match(/[a-z0-9]+/g) || [];
        
        let intersection = 0;
        for (let w of wordsA) {
            if (wordsB.includes(w)) intersection++;
        }
        
        // Exact match of normalized strings gets highest score
        let score = (intersection / Math.max(wordsA.length, wordsB.length));
        if (normDb === normDesc) score = 10;
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = p;
        }
    }

    if (bestMatch && bestScore > 0.4) {
        mappings.push({
            imgFile: img,
            newDesc: desc,
            dbId: bestMatch.id,
            oldDesc: bestMatch.nome,
            score: bestScore
        });
    } else {
        unmatchedImages.push({img, desc, bestMatch: bestMatch ? bestMatch.nome : null, score: bestScore});
    }
});

console.log(`Matched ${mappings.length} out of ${images.length} images.`);
if (unmatchedImages.length > 0) {
    console.log("Some unmatched or low score:");
    console.log(unmatchedImages.slice(0, 10));
}
console.log("Sample mappings:");
console.log(mappings.slice(0, 10));
