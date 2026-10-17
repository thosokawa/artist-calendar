// Fill in nameKana for artists and museums whose names use kanji and have no reading yet.
// Run after collect (see .github/workflows/collect.yml). Needs ANTHROPIC_API_KEY.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasKanji, fetchReadings } from '../src/readings.mjs';

const root = process.env.ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

const artistsPath = join(root, 'data/artists.json');
const artists = readJson(artistsPath);
const museumDir = join(root, 'data/museums');
const museums = readdirSync(museumDir).filter((f) => f.endsWith('.json')).map((f) => [join(museumDir, f), readJson(join(museumDir, f))]);

const todo = [
  ...Object.entries(artists).filter(([, a]) => hasKanji(a.name) && !a.nameKana).map(([slug, a]) => ({ id: `a:${slug}`, name: a.name, hint: a.nameRomaji })),
  ...museums.filter(([, m]) => hasKanji(m.name) && !m.nameKana).map(([, m]) => ({ id: `m:${m.id}`, name: m.name, hint: m.nameEn })),
];
if (!todo.length) { console.log('readings: nothing to add'); process.exit(0); }
const got = await fetchReadings(todo);
for (const [slug, a] of Object.entries(artists)) if (got.has(`a:${slug}`)) a.nameKana = got.get(`a:${slug}`);
writeJson(artistsPath, artists);
for (const [p, m] of museums) if (got.has(`m:${m.id}`)) { m.nameKana = got.get(`m:${m.id}`); writeJson(p, m); }
console.log(`readings: added ${got.size} of ${todo.length}`);
