// Static site build: data/*.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homePage, artistPage, museumPage, exhibitionPage, searchPage, indexPage, requestPage, esc } from '../src/templates.mjs';
import { GENRES, isSameTour, statusOn } from '../src/exhibitions.mjs';
import { buildCalendar, exhibitionEvent, googleCalendarUrl, addDays } from '../src/ics.mjs';
import { followText } from '../src/line.mjs';
import { artistProfiles, recommend } from '../src/recommend.mjs';
import { AREAS } from '../src/filter.mjs';

const root = process.env.ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (p, fb) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : fb);
const now = process.env.BUILD_NOW ? new Date(process.env.BUILD_NOW) : new Date();
// Dates are Japan dates.
const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

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
// Compact record used by the search page and by search-based LINE alerts (see src/filter.mjs).
const compact = (e) => ({
  id: e.id, t: e.title, s: e.startDate, e: e.endDate, k: e.kind, g: e.genres, f: e.firstSeenAt,
  m: museums[e.museumId].name, mid: e.museumId, ...(museums[e.museumId].kind === 'gallery' ? { v: 'gallery' } : {}), p: museums[e.museumId].prefecture, r: museums[e.museumId].area,
  a: e.artists.map((s) => [s, artists[s]?.name ?? s, ...(artists[s]?.aliases ?? []), artists[s]?.nameRomaji ?? '', artists[s]?.nameKana ?? '']),
});
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
  const lineUrl = site.lineBasicId ? `https://line.me/R/oaMessage/${encodeURIComponent(site.lineBasicId)}/?${encodeURIComponent(followText(artists[slug].name, slug))}` : null;
  page(`/artists/${slug}/`, artistPage({ site, slug, ctx, shows, recs: recommend(slug, profiles), genres: [...profiles[slug].genres], lineUrl }));
}
page('/artists/', indexPage({ site, path: '/artists/', title: '作家一覧', html: `<p class="lede">${artistSlugs.length}人の作家の展覧会を掲載しています。</p><ul class="chips">${artistSlugs.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(artists[s].name)}</a></li>`).join('')}</ul>` }));

// Museums
const museumList = Object.values(museums).sort((a, b) => AREAS.findIndex(([k]) => k === a.area) - AREAS.findIndex(([k]) => k === b.area) || a.name.localeCompare(b.name, 'ja'));
for (const m of museumList) {
  const shows = exhibitions.filter((e) => e.museumId === m.id).sort(byStart);
  page(`/museums/${m.id}/`, museumPage({ site, m, ctx, shows }));
}
// One list per kind (museums, then galleries), each grouped by area.
const venueChips = (ms) => `<ul class="chips">${ms.map((m) => `<li><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a></li>`).join('')}</ul>`;
page('/museums/', indexPage({ site, path: '/museums/', title: '美術館・ギャラリー一覧', html: [['museum', '美術館'], ['gallery', 'ギャラリー']].map(([kind, kindLabel]) => {
  const ofKind = museumList.filter((m) => (m.kind ?? 'museum') === kind);
  if (!ofKind.length) return '';
  return `<h2>${kindLabel}（${ofKind.length}）</h2>` + AREAS.map(([k, label]) => {
    const ms = ofKind.filter((m) => m.area === k);
    return ms.length ? `<p class="museum-group">${esc(label)}</p>${venueChips(ms)}` : '';
  }).join('');
}).join('') + '<p class="more-venues">載っていない美術館・ギャラリーは <a href="/request/">リクエスト</a> してください。</p>' }));
page('/request/', requestPage({ site }));

// Exhibitions, each with a one-event calendar file for "add to my calendar".
const gcal = (e) => googleCalendarUrl(e, { museum: museums[e.museumId], siteUrl: site.baseUrl });
for (const e of exhibitions) {
  const otherVenues = exhibitions.filter((o) => isSameTour(e, o)).sort(byStart);
  page(`/exhibitions/${e.id}/`, exhibitionPage({ site, e, ctx, otherVenues, googleUrl: gcal(e), icsUrl: `/exhibitions/${e.id}.ics` }));
  write(`exhibitions/${e.id}.ics`, buildCalendar([exhibitionEvent(e, { museum: museums[e.museumId], siteUrl: site.baseUrl, host })], { name: e.title, now }));
}

// Announcements of the last 14 days, for the LINE notifier (functions/api/notify.js).
const since = addDays(today, -14);
write('data/recent.json', JSON.stringify(announcements.filter((a) => a.date >= since && exById[a.exhibitionId]).map((a) => {
  const e = exById[a.exhibitionId];
  return { id: e.id, title: e.title, museum: museums[e.museumId].name, startDate: e.startDate, endDate: e.endDate, slugs: e.artists, artists: e.artists.map((s) => artists[s]?.name ?? s), gcal: gcal(e), announcedAt: a.date, rec: compact(e) };
})));

// Artist names, for the LINE bot's search.
write('data/artists.json', JSON.stringify(Object.fromEntries(artistSlugs.map((s) => [s, artists[s].name]))));

// Search: the page filters this file in the browser.
const prefsByArea = AREAS.map(([k, label]) => [k, label, [...new Set(museumList.filter((m) => m.area === k).map((m) => m.prefecture))]]);
page('/search/', searchPage({ site, genres: GENRES, prefsByArea, museums: museumList, lineBasicId: site.lineBasicId }));
write('data/search.json', JSON.stringify(live.map(compact)));
// Search box suggestions: [kind, page path, name, reading, latin name].
write('data/suggest.json', JSON.stringify([
  ...artistSlugs.map((s) => ['作家', `/artists/${s}/`, artists[s].name, artists[s].nameKana ?? '', artists[s].nameRomaji ?? '']),
  ...museumList.map((m) => [m.kind === 'gallery' ? 'ギャラリー' : '美術館', `/museums/${m.id}/`, m.name, m.nameKana ?? '', m.nameEn ?? '']),
]));
write('data/museum-names.json', JSON.stringify(Object.fromEntries(museumList.map((m) => [m.id, m.name]))));
cpSync(join(root, 'src/filter.mjs'), join(dist, 'assets/filter.mjs'));

page('/about/', indexPage({ site, path: '/about/', title: 'このサイトについて', html: `
<p>${esc(site.name)}は、好きな作家の展覧会を見逃さないためのサイトです。</p>
<h2>料金</h2><p>無料でご利用いただけます。LINEで通知を受け取れるのは、作家5人・検索条件1つまでです。もっと多く登録できる有料プラン（月額300円程度）を準備中です。</p>
<h2>情報の集め方</h2><ul><li>各美術館・ギャラリーの公式サイトの展覧会一覧を定期的に確認し、新しい展覧会を自動で追加しています。</li><li>展覧会名・会期・会場・作家名などの事実のみを掲載し、紹介文は独自に作成しています。画像や公式の文章は転載しません。</li><li>開館時間・料金・予約などは必ず公式サイトでご確認ください。</li></ul>
${site.moshimoRakuten?.a_id ? '<h2>広告について</h2><p>当サイトはもしもアフィリエイトを通じて楽天市場などのアフィリエイトに参加しています。「PR」と表示したリンクから商品を購入されると、当サイトに紹介料が支払われることがあります。掲載する展覧会の情報や順番は、広告とは関係なく決めています。</p>' : ''}
<h2>運営</h2><p>運営: ${esc(site.operator)}　連絡先: ${esc(site.contactEmail)}</p>` }));
page('/privacy/', indexPage({ site, path: '/privacy/', title: 'プライバシー', html: '<ul><li>LINEでの通知のために、LINEのユーザーID（LINEが発行する識別番号）と登録した作家だけを保存します。お名前やプロフィールは保存しません。友だちを解除すると通知は止まります。</li><li>カレンダーへの予定の追加はお使いのカレンダーアプリ側で行われ、当サイトが予定の内容を受け取ることはありません。</li><li>アクセス解析には Cookie を使わない方式を使います。</li>' + (site.moshimoRakuten?.a_id ? '<li>「PR」と表示したリンクはアフィリエイトのリンクです。リンク先で、もしもアフィリエイトや楽天が Cookie を使うことがあります。</li>' : '') + '</ul>' }));

cpSync(join(root, 'public'), dist, { recursive: true });
write('robots.txt', site.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(site.baseUrl + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`built ${urls.length} pages: ${artistSlugs.length} artists, ${museumList.length} museums, ${exhibitions.length} exhibitions (${live.length} current or upcoming)`);
