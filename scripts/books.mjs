// Look up artist books on Rakuten Books (official API) and keep them in data/books.json.
// Artists with current or upcoming shows go first; each entry is refreshed after 30 days.
// Needs RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY (RAKUTEN_AFFILIATE_ID adds affiliate links); skips quietly without them.
// Usage: node scripts/books.mjs [--artists=150]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchBooks, pickBooks } from '../src/books.mjs';
import { statusOn } from '../src/exhibitions.mjs';

const { RAKUTEN_APP_ID: appId, RAKUTEN_ACCESS_KEY: accessKey, RAKUTEN_AFFILIATE_ID: affiliateId } = process.env;
if (!appId || !accessKey) { console.log('RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY not set; skipping books.'); process.exit(0); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const limit = Number(process.argv.find((a) => a.startsWith('--artists='))?.slice(10) ?? 150);
const artists = readJson(join(root, 'data/artists.json'), {});
const exDir = join(root, 'data/exhibitions');
const shows = readdirSync(exDir).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(join(exDir, f), []));
const booksPath = join(root, 'data/books.json');
const books = readJson(booksPath, {});
// A change of affiliate id means every stored link must be fetched again.
const stale = (b) => !b || b.checkedAt < new Date(Date.parse(today) - 30 * 86400e3).toISOString().slice(0, 10) || Boolean(affiliateId) !== b.items.every((x) => x.affiliate);

const rank = {};
for (const e of shows) for (const s of e.artists) {
  const st = statusOn(e, today);
  rank[s] = Math.max(rank[s] ?? 0, st === 'current' ? 3 : st === 'upcoming' ? 2 : 1);
}
const todo = Object.keys(artists).filter((s) => rank[s] && stale(books[s])).sort((a, b) => rank[b] - rank[a]).slice(0, limit);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let found = 0;
for (const slug of todo) {
  const a = artists[slug];
  try {
    const items = await searchBooks({ name: a.name, appId, accessKey, affiliateId });
    const picked = pickBooks([a.name, ...(a.aliases ?? [])], items);
    books[slug] = { checkedAt: today, items: picked };
    if (picked.length) found++;
    console.log(`${picked.length ? '✓' : '·'} ${a.name} ${picked.length}`);
  } catch (e) {
    console.log(`✗ ${a.name}: ${e.message}`);
    if (/\b(401|403)\b/.test(e.message)) break;
  }
  await sleep(1100); // the API allows about one request per second
}
writeFileSync(booksPath, JSON.stringify(books, null, 2) + '\n');
console.log(`books: checked ${todo.length}, with books ${found}`);
