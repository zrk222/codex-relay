import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const html = readFileSync('docs/index.html', 'utf8'), css = readFileSync('docs/style.css', 'utf8');
mkdirSync('.prestige', { recursive: true });
writeFileSync('.prestige/full-preview.html', html.replace('<link rel="stylesheet" href="./style.css">', `<style>${css}</style>`));
const sha = text => createHash('sha256').update(text).digest('hex');
writeFileSync('.prestige/source-binding.json', JSON.stringify({ html: sha(html), css: sha(css), composed: sha(readFileSync('.prestige/full-preview.html')) }, null, 2));
console.log('Composed the unchanged HTML and CSS for single-file design tools.');
