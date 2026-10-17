// Check every museum's official exhibition list.
//   unchanged page   -> nothing to do
//   changed page     -> Claude reads the page; new exhibitions are added, known ones updated
//   new exhibitions  -> appended to data/announcements.json (feeds the "new" list, and later LINE notices)
//   fetch failing 3+ times in a row -> listed in data/monitor/alerts.md
// Exhibitions whose title cannot be found on the page are dropped, to catch invented entries.
//
// Usage: node scripts/collect.mjs [--dry-run] [--only=<museum-id>] [--force]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText, sha256 } from '../src/text.mjs';
import { mergeExhibitions, titleOnPage } from '../src/exhibitions.mjs';

// ART_ROOT lets tests run against a copy of the data.
const root = process.env.ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const only = [...args].find((a) => a.startsWith('--only='))?.slice(7);
const now = new Date();
const today = process.env.COLLECT_TODAY ?? now.toISOString().slice(0, 10);
const MIN_TEXT = 200;
const USER_AGENT = 'ArtistCalendarBot/0.1 (+https://github.com/thosokawa; reads exhibition lists a few times a week)';

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, v) => { if (!dryRun) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); } };

const monitorDir = join(root, 'data/monitor');
const statusPath = join(monitorDir, 'status.json');
const status = readJson(statusPath, {});
const artistsPath = join(root, 'data/artists.json');
const registry = readJson(artistsPath, {});
const annPath = join(root, 'data/announcements.json');
const announcements = readJson(annPath, []);

async function fetchPlain(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'ja,en;q=0.8' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return htmlToText(await res.text());
}

let browser;
async function fetchWithBrowser(url) {
  const { chromium } = await import('playwright');
  browser ??= await chromium.launch();
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    // Some museum sites never go network-idle (analytics, video); give scripts a few seconds instead.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    return htmlToText(await page.content());
  } finally {
    await page.close();
  }
}

async function getText(url) {
  try {
    const text = await fetchPlain(url);
    if (text.length >= MIN_TEXT) return text;
  } catch {
    // fall through to the browser
  }
  return fetchWithBrowser(url);
}

const alerts = [];
let addedCount = 0;
const museums = readdirSync(join(root, 'data/museums')).filter((f) => f.endsWith('.json')).map((f) => readJson(join(root, 'data/museums', f)));
for (const museum of museums) {
  if (only && museum.id !== only) continue;
  if (museum.status === 'closed') continue;
  const st = (status[museum.id] ??= { failures: 0 });
  let text;
  try {
    text = await getText(museum.exhibitionsUrl);
    if (text.length < MIN_TEXT) throw new Error(`page text too short (${text.length} chars)`);
  } catch (e) {
    st.failures += 1;
    st.lastError = `${today}: ${e.message}`;
    console.log(`✗ ${museum.id} (${st.failures} in a row): ${e.message}`);
    if (st.failures >= 3) alerts.push(`- ${museum.name}: ${museum.exhibitionsUrl} を${st.failures}回続けて読めませんでした (${e.message})`);
    continue;
  }
  st.failures = 0;
  st.lastCheckedAt = now.toISOString();
  const hash = sha256(text);
  if (st.hash === hash && !force) {
    console.log(`= ${museum.id} unchanged`);
    continue;
  }

  console.log(`~ ${museum.id} changed; asking Claude`);
  const { extractExhibitions } = await import('../src/extract.mjs');
  // COLLECT_FAKE_EXTRACTION (a JSON file of {museumId: [...]}) replaces the Claude call in tests.
  const result = process.env.COLLECT_FAKE_EXTRACTION
    ? { ok: true, exhibitions: readJson(process.env.COLLECT_FAKE_EXTRACTION)[museum.id] ?? [] }
    : await extractExhibitions({ museum, pageText: text, today }).catch((e) => ({ ok: false, reason: e.message }));
  if (!result.ok) {
    console.log(`  reading failed: ${result.reason}`);
    alerts.push(`- ${museum.name}: ページは変わりましたが自動で読み取れませんでした (${result.reason})`);
    continue;
  }
  const fresh = result.exhibitions.filter((x) => {
    // Very long runs are permanent installations, not exhibitions.
    const ok = titleOnPage(x.title, text) && x.endDate >= today && Date.parse(x.endDate) - Date.parse(x.startDate) < 730 * 86400e3;
    if (!ok) console.log(`  skipped: ${x.title}`);
    return ok;
  });
  const exPath = join(root, 'data/exhibitions', `${museum.id}.json`);
  const { exhibitions, added } = mergeExhibitions({ museumId: museum.id, stored: readJson(exPath, []), fresh, registry, today });
  writeJson(exPath, exhibitions);
  addedCount += added.length;
  // The first reading of a museum only sets the baseline: its shows are not "newly announced".
  const firstReading = !st.hash;
  for (const e of added) {
    console.log(`  + ${e.title} (${e.startDate}〜${e.endDate})${firstReading ? ' [baseline]' : ''}`);
    if (!firstReading) announcements.push({ date: today, exhibitionId: e.id, museumId: museum.id, artists: e.artists });
  }
  st.hash = hash;
  if (museum.status === 'unreachable' && !dryRun) {
    museum.status = 'ok';
    writeJson(join(root, 'data/museums', `${museum.id}.json`), museum);
  }
}
await browser?.close();

writeJson(statusPath, status);
writeJson(artistsPath, Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b))));
writeJson(annPath, announcements);
if (!dryRun) {
  mkdirSync(monitorDir, { recursive: true });
  writeFileSync(join(monitorDir, 'alerts.md'), alerts.length ? `読み取りに問題のある美術館:\n\n${alerts.join('\n')}\n` : '');
}
console.log(`done: ${addedCount} new exhibition(s)`);
