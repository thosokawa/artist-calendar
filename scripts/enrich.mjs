// Fill in extra page facts from official sites. Each item is tried once (its *CheckedAt date),
// so the daily run only handles what is new.
// Usage: node scripts/enrich.mjs [--venues=15] [--galleries=10] [--artists=20] [--monthly=1]
//   venues:    address, access and closing days (museums and galleries)
//   galleries: which of our artists a gallery lists on its artist page
//   artists:   a short profile from the artist's site or their gallery's page on them
//   monthly:   1 = (re)write the note on this month's and next month's round-ups when over a week old
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText } from '../src/text.mjs';
import { fetchHtml, closeBrowser } from '../src/fetch-html.mjs';
import { readVenueInfo, writeArtistProfile, writeMonthIntro, accessLinks, artistsLink, artistsOnPage, artistPageLink } from '../src/enrich.mjs';
import { usageSummary } from '../src/usage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
// Footers usually carry the address, so they are kept here (htmlToText drops them by default).
const fullText = (html) => htmlToText(html.replace(/<(\/?)(footer|header)\b/gi, '<$1div'));
const html = {};
const get = async (url) => (html[url] ??= await fetchHtml(url).catch(() => ''));

const venueDir = join(root, 'data/museums');
const venues = readdirSync(venueDir).filter((f) => f.endsWith('.json')).map((f) => readJson(join(venueDir, f)));
const saveVenue = (v) => writeJson(join(venueDir, `${v.id}.json`), v);
const artistsPath = join(root, 'data/artists.json');
const artists = readJson(artistsPath);
const usable = (v) => v.status !== 'unreadable';

// 1. Venue basics: the top page plus up to two access-like pages it links to.
for (const v of venues.filter((x) => !x.infoCheckedAt && usable(x)).slice(0, arg('venues', 15))) {
  try {
    const top = await get(v.officialUrl);
    const pages = [[v.officialUrl, top], ...await Promise.all(accessLinks(top, v.officialUrl).slice(0, 2).map(async (u) => [u, await get(u)]))];
    const text = pages.map(([u, h]) => `【${u}】\n${fullText(h)}`).join('\n\n');
    const info = text.length > 400 ? await readVenueInfo({ venue: v, pageText: text }) : {};
    for (const k of ['address', 'access', 'closed']) { if (info[k]) v[k] = info[k]; else delete v[k]; }
    // The page the address came from, for the "check the official site" link.
    const from = info.address && pages.find(([, h]) => fullText(h).replace(/\s/g, '').includes(info.address.replace(/\s/g, '')));
    if (from && from[0] !== v.officialUrl) v.accessUrl = from[0];
    console.log(`${v.address ? '✓' : '·'} venue ${v.id} ${v.address ?? ''} | ${v.access ?? ''} | ${v.closed ?? ''}`);
  } catch (e) {
    console.log(`✗ venue ${v.id}: ${e.message}`);
    continue;
  }
  v.infoCheckedAt = today;
  saveVenue(v);
}

// 2. Gallery artist lists: our artists named there, and the link to each one's page.
for (const g of venues.filter((x) => x.kind === 'gallery' && !x.representsCheckedAt && usable(x)).slice(0, arg('galleries', 10))) {
  try {
    const top = await get(g.officialUrl);
    const url = artistsLink(top, g.officialUrl);
    const page = url ? await get(url) : '';
    const found = page ? artistsOnPage(htmlToText(page), artists) : [];
    if (found.length) g.represents = found; else delete g.represents;
    for (const s of found) {
      const link = artistPageLink(page, url, artists[s]);
      if (link && !artists[s].profileUrl) { artists[s].profileUrl = link; artists[s].profileSource = g.name; }
    }
    console.log(`${found.length ? '✓' : '·'} gallery ${g.id} ${url ?? '(no artist list)'} ${found.join(', ')}`);
  } catch (e) {
    console.log(`✗ gallery ${g.id}: ${e.message}`);
    continue;
  }
  g.representsCheckedAt = today;
  saveVenue(g);
}
writeJson(artistsPath, artists);

// 3. Artist profiles, for artists with their own site or a gallery page about them.
let n = arg('artists', 20);
for (const [slug, a] of Object.entries(artists)) {
  if (n <= 0) break;
  const url = a.profileUrl ?? a.website;
  if (a.profileCheckedAt || !url) continue;
  n -= 1;
  try {
    const text = htmlToText(await get(url));
    a.profile = text.length > 300 ? await writeArtistProfile({ artist: a, pageText: text }) : '';
    if (!a.profileUrl && a.profile) { a.profileUrl = a.website; a.profileSource = '公式サイト'; }
    console.log(`${a.profile ? '✓' : '·'} artist ${slug} ${a.profile.slice(0, 50)}`);
  } catch (e) {
    console.log(`✗ artist ${slug}: ${e.message}`);
    continue;
  }
  if (!a.profile) delete a.profile;
  a.profileCheckedAt = today;
  writeJson(artistsPath, artists);
}

// 4. Month notes, from the shows in the round-up (no web pages needed).
if (arg('monthly', 1)) {
  const byId = Object.fromEntries(venues.map((v) => [v.id, v]));
  const shows = readdirSync(join(root, 'data/exhibitions')).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(join(root, 'data/exhibitions', f))).filter((e) => byId[e.museumId]);
  const ym = today.slice(0, 7);
  const next = new Date(`${ym}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  mkdirSync(join(root, 'data/monthly'), { recursive: true });
  for (const m of [ym, next.toISOString().slice(0, 7)]) {
    const path = join(root, `data/monthly/${m}.json`);
    const old = existsSync(path) ? readJson(path) : {};
    if (old.writtenAt && (Date.parse(today) - Date.parse(old.writtenAt)) / 864e5 < 7) continue;
    const pick = (e) => ({ title: e.title, venue: byId[e.museumId].name, pref: byId[e.museumId].prefecture, startDate: e.startDate, endDate: e.endDate });
    const opening = shows.filter((e) => e.startDate.startsWith(m)).map(pick);
    const closing = shows.filter((e) => e.endDate.startsWith(m) && !e.startDate.startsWith(m)).map(pick);
    if (opening.length + closing.length < 5) continue;
    try {
      const intro = await writeMonthIntro({ label: `${+m.slice(0, 4)}年${+m.slice(5)}月`, opening, closing });
      writeJson(path, { intro, writtenAt: today });
      console.log(`✓ month ${m} ${intro.slice(0, 50)}`);
    } catch (e) {
      console.log(`✗ month ${m}: ${e.message}`);
    }
  }
}

await closeBrowser();
console.log(usageSummary());
