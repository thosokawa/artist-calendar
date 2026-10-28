// Look up artists' official websites and social accounts (see src/artist-sns.mjs).
// Usage: node scripts/sns-artists.mjs [--limit=40] [--only=slug,slug] [--recheck]
// Artists with a current or upcoming show go first; each artist is looked up once
// (snsCheckedAt), so a daily run works through the backlog and then only new names.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findArtistSns } from '../src/artist-sns.mjs';
import { closeBrowser } from '../src/fetch-html.mjs';
import { usageSummary } from '../src/usage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const limit = Number(arg('limit') ?? 40);
const only = arg('only')?.split(',').filter(Boolean);
const recheck = process.argv.includes('--recheck');
const today = new Date().toISOString().slice(0, 10);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const artistsPath = join(root, 'data/artists.json');
const artists = readJson(artistsPath);
const venues = readdirSync(join(root, 'data/museums')).filter((f) => f.endsWith('.json')).map((f) => readJson(join(root, 'data/museums', f)));
const venueHosts = new Set(venues.map((m) => { try { return new URL(m.officialUrl).hostname.replace(/^www\./, ''); } catch { return ''; } }));

// Most recent end date per artist, so people with shows on now are looked up first.
const lastEnd = {};
for (const f of readdirSync(join(root, 'data/exhibitions')).filter((x) => x.endsWith('.json'))) {
  for (const e of readJson(join(root, 'data/exhibitions', f))) for (const s of e.artists ?? []) if (!lastEnd[s] || e.endDate > lastEnd[s]) lastEnd[s] = e.endDate;
}
const queue = (only?.length ? only : Object.keys(artists).filter((s) => recheck || !artists[s].snsCheckedAt))
  .filter((s) => artists[s])
  .sort((a, b) => (lastEnd[b] ?? '').localeCompare(lastEnd[a] ?? ''))
  .slice(0, only?.length ? undefined : limit);

let found = 0;
for (const slug of queue) {
  const a = artists[slug];
  try {
    const r = await findArtistSns(a, { venueHosts, log: console.log });
    a.website = r.website ?? a.website;
    if (Object.keys(r.sns).length) a.sns = { ...a.sns, ...r.sns };
    a.snsCheckedAt = today;
    if (r.website || Object.keys(r.sns).length) found += 1;
    console.log(`${r.website || Object.keys(r.sns).length ? '✓' : '·'} ${slug}: ${[r.website, ...Object.values(r.sns)].filter(Boolean).join(' ') || 'none confirmed'}`);
  } catch (e) {
    console.log(`✗ ${slug}: ${e.message}`);
  }
  // Save as we go so a cancelled run keeps what it found.
  writeFileSync(artistsPath, JSON.stringify(artists, null, 2) + '\n');
}
await closeBrowser();
console.log(`looked up ${queue.length}, confirmed ${found}; ${Object.values(artists).filter((x) => !x.snsCheckedAt).length} artists left`);
console.log(usageSummary());
