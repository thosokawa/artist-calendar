// One-off: turn hand-checked seed files into data/museums and data/exhibitions.
// Usage: node scripts/import-seed.mjs <seed-dir> [today]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeExhibitions } from '../src/exhibitions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [seedDir, today = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const readJson = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);
const write = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };

const registry = readJson(join(root, 'data/artists.json'), {});
for (const f of readdirSync(seedDir).filter((f) => f.endsWith('.json')).sort()) {
  const { museum, exhibitions: fresh } = JSON.parse(readFileSync(join(seedDir, f), 'utf8'));
  write(join(root, 'data/museums', `${museum.id}.json`), museum);
  const exPath = join(root, 'data/exhibitions', `${museum.id}.json`);
  const { exhibitions, added } = mergeExhibitions({ museumId: museum.id, stored: readJson(exPath, []), fresh: fresh.filter((x) => x.endDate >= today), registry, today });
  write(exPath, exhibitions);
  console.log(`${museum.id}: ${museum.status}, ${added.length} added, ${exhibitions.length} total`);
}
write(join(root, 'data/artists.json'), Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b))));
