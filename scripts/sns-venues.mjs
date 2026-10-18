// Find each venue's official social accounts from the links on its own official site.
// Usage: node scripts/sns-venues.mjs [--all] [--only=id,id]
// Without --all, only venues that have not been checked yet are read.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHtml, closeBrowser } from '../src/fetch-html.mjs';
import { snsLinksInHtml, SNS_KINDS } from '../src/sns.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const all = process.argv.includes('--all');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
const today = new Date().toISOString().slice(0, 10);
const dir = join(root, 'data/museums');

const hasAny = (h) => Object.values(snsLinksInHtml(h)).some((l) => l.length);
let found = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const path = join(dir, f);
  const m = JSON.parse(readFileSync(path, 'utf8'));
  if (only?.length ? !only.includes(m.id) : !all && m.snsCheckedAt) continue;
  // Accounts usually sit in the header or footer of the top page; the exhibition list is a second chance.
  const pages = [...new Set([m.officialUrl, m.exhibitionsUrl].filter(Boolean))];
  const sns = {};
  for (const url of pages) {
    const links = snsLinksInHtml(await fetchHtml(url, { enough: hasAny }));
    for (const k of SNS_KINDS) if (!sns[k] && links[k][0]) sns[k] = links[k][0];
    if (Object.keys(sns).length) break;
  }
  m.sns = Object.keys(sns).length ? sns : undefined;
  m.snsCheckedAt = today;
  if (m.sns) found += 1;
  console.log(`${m.sns ? '✓' : '·'} ${m.id}: ${Object.values(sns).join(' ') || 'no accounts linked'}`);
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
}
await closeBrowser();
console.log(`venues with accounts: ${found}`);
