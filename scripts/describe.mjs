// Write original descriptions for venues and current/upcoming exhibitions that do not have one yet.
// Usage: node scripts/describe.mjs [--venues=20] [--exhibitions=60]
// Each item is tried once (describedAt), so the daily run only handles what is new.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText } from '../src/text.mjs';
import { fetchHtml, closeBrowser } from '../src/fetch-html.mjs';
import { describeVenue, describeExhibition } from '../src/describe.mjs';
import { usageSummary } from '../src/usage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
// Pages too short to describe anything (bot checks, empty shells) are skipped.
const MIN_TEXT = 400;

async function pageText(url) {
  const text = htmlToText(await fetchHtml(url));
  return text.length >= MIN_TEXT ? text : '';
}

// A show's own page, found on the venue's list page by a link whose text contains the title's start.
const listHtml = {};
const norm = (t) => String(t).normalize('NFKC').replace(/<[^>]+>/g, '').replace(/[\s「」『』“”"'・:：\-—―〜~()（）]/g, '').toLowerCase();
async function findDetailUrl(e, venue) {
  const html = (listHtml[venue.exhibitionsUrl] ??= await fetchHtml(venue.exhibitionsUrl).catch(() => ''));
  const key = norm(e.title).slice(0, 10);
  if (key.length < 4) return null;
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!norm(m[2]).includes(key)) continue;
    try {
      const u = new URL(m[1].replace(/&amp;/g, '&'), venue.exhibitionsUrl);
      if (/^https?:$/.test(u.protocol) && u.href !== venue.exhibitionsUrl && !/\.(pdf|jpe?g|png)$/i.test(u.pathname)) return u.href;
    } catch { /* not a usable link */ }
  }
  return null;
}

const venueDir = join(root, 'data/museums');
const venues = Object.fromEntries(readdirSync(venueDir).filter((f) => f.endsWith('.json')).map((f) => { const v = readJson(join(venueDir, f)); return [v.id, v]; }));
const artists = readJson(join(root, 'data/artists.json'));

let done = 0;
for (const v of Object.values(venues).filter((x) => !x.describedAt && x.status !== 'unreadable').slice(0, arg('venues', 20))) {
  try {
    const text = await pageText(v.officialUrl);
    v.intro = text ? await describeVenue({ venue: v, pageText: text }) : '';
    console.log(`${v.intro ? '✓' : '·'} ${v.id} ${v.intro.slice(0, 40)}`);
    done += 1;
  } catch (e) {
    console.log(`✗ ${v.id}: ${e.message}`);
    continue;
  }
  v.describedAt = today;
  if (!v.intro) delete v.intro;
  writeJson(join(venueDir, `${v.id}.json`), v);
}

const exDir = join(root, 'data/exhibitions');
let budget = arg('exhibitions', 60);
const listPages = {};
for (const f of readdirSync(exDir).filter((x) => x.endsWith('.json'))) {
  if (budget <= 0) break;
  const list = readJson(join(exDir, f));
  let changed = false;
  for (const e of list) {
    if (budget <= 0) break;
    // Only shows people can still go to. Without a page of its own, the venue's list page is used;
    // it often has a paragraph on each show, and the text stays empty when it does not.
    if (e.describedAt || e.endDate < today || !venues[e.museumId]) continue;
    budget -= 1;
    try {
      // Found detail links are kept, so the page's "official details" button goes straight to the show.
      e.detailUrl ??= await findDetailUrl(e, venues[e.museumId]);
      const url = e.detailUrl ?? venues[e.museumId].exhibitionsUrl;
      const text = e.detailUrl ? await pageText(url) : (listPages[url] ??= await pageText(url));
      e.description = text ? await describeExhibition({ exhibition: e, venue: venues[e.museumId], artistNames: e.artists.map((s) => artists[s]?.name ?? s), pageText: text }) : '';
      console.log(`${e.description ? '✓' : '·'} ${e.id} ${e.description.slice(0, 40)}`);
      done += 1;
    } catch (err) {
      console.log(`✗ ${e.id}: ${err.message}`);
      continue;
    }
    e.describedAt = today;
    if (!e.description) delete e.description;
    changed = true;
  }
  if (changed) writeJson(join(exDir, f), list);
}
await closeBrowser();
console.log(`described ${done}`);
console.log(usageSummary());
