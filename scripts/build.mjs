// Static site build: data/*.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homePage, artistPage, museumPage, exhibitionPage, searchPage, indexPage, esc } from '../src/templates.mjs';
import { GENRES, isSameTour, statusOn } from '../src/exhibitions.mjs';
import { buildCalendar, exhibitionEvents, addDays } from '../src/ics.mjs';
import { artistProfiles, recommend } from '../src/recommend.mjs';

const root = process.env.ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (p, fb) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : fb);
const now = process.env.BUILD_NOW ? new Date(process.env.BUILD_NOW) : new Date();
// Dates are Japan dates.
const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export const AREAS = [['hokkaido-tohoku', '北海道・東北'], ['kanto', '関東'], ['chubu', '中部'], ['kansai', '関西'], ['chugoku-shikoku', '中国・四国'], ['kyushu-okinawa', '九州・沖縄']];

const site = readJson('site.config.json');
const host = new URL(site.baseUrl).hostname;
const museums = Object.fromEntries(readdirSync(join(root, 'data/museums')).filter((f) => f.endsWith('.json')).map((f) => { const m = readJson(`data/museums/${f}`); return [m.id, m]; }));
const exhibitions = readdirSync(join(root, 'data/exhibitions')).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(`data/exhibitions/${f}`)).filter((e) => museums[e.museumId]);
const artists = readJson('data/artists.json', {});
const announcements = readJson('data/announcements.json', []);
const ctx = { museums, artists, today };
const byStart = (a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title);
const live = exhibitions.filter((e) => e.endDate >= today).sort(byStart);

rmSync(dist, { recursive: true, force: true });
const write = (path, content) => {
  const full = join(dist, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};
const urls = [];
const page = (path, html) => { write(`${path.replace(/^\//, '')}index.html`, html); urls.push(path); };

// Home
const exById = Object.fromEntries(exhibitions.map((e) => [e.id, e]));
const recent = [...announcements].reverse().map((a) => exById[a.exhibitionId]).filter((e) => e && e.endDate >= today).slice(0, 12);
const endingSoon = live.filter((e) => statusOn(e, today) === 'current' && e.endDate <= addDays(today, 21)).sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 12);
const upcoming = live.filter((e) => statusOn(e, today) === 'upcoming').slice(0, 12);
const counts = {};
for (const e of exhibitions) for (const s of e.artists) counts[s] = (counts[s] ?? 0) + 1;
const topArtists = Object.keys(counts).filter((s) => artists[s]).sort((a, b) => counts[b] - counts[a] || artists[a].name.localeCompare(artists[b].name, 'ja')).slice(0, 30);
page('/', homePage({ site, ctx, recent, endingSoon, upcoming, topArtists }));

// Artists
const profiles = artistProfiles(exhibitions);
const artistSlugs = Object.keys(artists).filter((s) => profiles[s]).sort((a, b) => artists[a].name.localeCompare(artists[b].name, 'ja'));
for (const slug of artistSlugs) {
  const shows = exhibitions.filter((e) => e.artists.includes(slug)).sort(byStart);
  page(`/artists/${slug}/`, artistPage({ site, slug, ctx, shows, recs: recommend(slug, profiles), genres: [...profiles[slug].genres] }));
  write(`artists/${slug}.ics`, buildCalendar(shows.flatMap((e) => exhibitionEvents(e, { museum: museums[e.museumId], siteUrl: site.baseUrl, host, today })), { name: `${artists[slug].name}の展覧会`, now }));
}
page('/artists/', indexPage({ site, path: '/artists/', title: '作家一覧', html: `<p class="lede">${artistSlugs.length}人の作家の展覧会を掲載しています。</p><ul class="chips">${artistSlugs.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(artists[s].name)}</a></li>`).join('')}</ul>` }));

// Museums
const museumList = Object.values(museums).sort((a, b) => AREAS.findIndex(([k]) => k === a.area) - AREAS.findIndex(([k]) => k === b.area) || a.name.localeCompare(b.name, 'ja'));
for (const m of museumList) {
  const shows = exhibitions.filter((e) => e.museumId === m.id).sort(byStart);
  page(`/museums/${m.id}/`, museumPage({ site, m, ctx, shows }));
  write(`museums/${m.id}.ics`, buildCalendar(shows.flatMap((e) => exhibitionEvents(e, { museum: m, siteUrl: site.baseUrl, host, today })), { name: `${m.name}の展覧会`, now }));
}
page('/museums/', indexPage({ site, path: '/museums/', title: '美術館一覧', html: AREAS.map(([k, label]) => {
  const ms = museumList.filter((m) => m.area === k);
  return ms.length ? `<h2>${esc(label)}</h2><ul class="chips">${ms.map((m) => `<li><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a></li>`).join('')}</ul>` : '';
}).join('') }));

// Exhibitions
for (const e of exhibitions) {
  const otherVenues = exhibitions.filter((o) => isSameTour(e, o)).sort(byStart);
  const m = museums[e.museumId];
  const gp = new URLSearchParams({ action: 'TEMPLATE', text: `${e.title}（${m.name}）`, dates: `${e.startDate.replace(/-/g, '')}/${addDays(e.endDate, 1).replace(/-/g, '')}`, details: `${site.baseUrl}/exhibitions/${e.id}/`, location: m.name });
  page(`/exhibitions/${e.id}/`, exhibitionPage({ site, e, ctx, otherVenues, googleUrl: `https://calendar.google.com/calendar/render?${gp}` }));
}

// Search: the page filters this file in the browser.
page('/search/', searchPage({ site, genres: GENRES, areas: AREAS }));
write('data/search.json', JSON.stringify(live.map((e) => ({
  id: e.id, t: e.title, s: e.startDate, e: e.endDate, k: e.kind, g: e.genres,
  m: museums[e.museumId].name, p: museums[e.museumId].prefecture, r: museums[e.museumId].area,
  a: e.artists.map((s) => [s, artists[s]?.name ?? s, ...(artists[s]?.aliases ?? []), artists[s]?.nameRomaji ?? '']),
}))));

page('/about/', indexPage({ site, path: '/about/', title: 'このサイトについて', html: `
<p>${esc(site.name)}は、好きな作家の展覧会を見逃さないためのサイトです。</p>
<h2>情報の集め方</h2><ul><li>各美術館の公式サイトの展覧会一覧を定期的に確認し、新しい展覧会を自動で追加しています。</li><li>展覧会名・会期・会場・作家名などの事実のみを掲載し、紹介文は独自に作成しています。画像や公式の文章は転載しません。</li><li>開館時間・料金・予約などは必ず公式サイトでご確認ください。</li></ul>
<h2>運営</h2><p>運営: ${esc(site.operator)}　連絡先: ${esc(site.contactEmail)}</p>` }));
page('/privacy/', indexPage({ site, path: '/privacy/', title: 'プライバシー', html: '<ul><li>カレンダーの登録はお使いのカレンダーアプリ側で行われ、当サイトが予定の内容を受け取ることはありません。</li><li>アクセス解析には Cookie を使わない方式を使います。</li></ul>' }));

cpSync(join(root, 'public'), dist, { recursive: true });
write('robots.txt', site.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(site.baseUrl + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`built ${urls.length} pages: ${artistSlugs.length} artists, ${museumList.length} museums, ${exhibitions.length} exhibitions (${live.length} current or upcoming)`);
