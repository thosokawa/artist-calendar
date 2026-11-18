// Static site build: data/*.json -> dist/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homePage, artistPage, museumPage, exhibitionPage, searchPage, indexPage, requestPage, areaPage, monthlyPage, esc } from '../src/templates.mjs';
import { GENRES, isSameTour, statusOn } from '../src/exhibitions.mjs';
import { buildCalendar, exhibitionEvent, googleCalendarUrl, addDays } from '../src/ics.mjs';
import { followText } from '../src/line.mjs';
import { artistProfiles, recommend } from '../src/recommend.mjs';
import { AREAS } from '../src/filter.mjs';
import { sha256 } from '../src/text.mjs';

const root = process.env.ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (p, fb) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : fb);
const now = process.env.BUILD_NOW ? new Date(process.env.BUILD_NOW) : new Date();
// Dates are Japan dates.
const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

const site = readJson('site.config.json');
// Changes with the stylesheet, so browsers fetch the new one instead of a cached copy.
site.cssVersion = sha256(readFileSync(join(root, 'public/assets/style.css'), 'utf8')).slice(0, 8);
const host = new URL(site.baseUrl).hostname;
const museums = Object.fromEntries(readdirSync(join(root, 'data/museums')).filter((f) => f.endsWith('.json')).map((f) => { const m = readJson(`data/museums/${f}`); return [m.id, m]; }));
const exhibitions = readdirSync(join(root, 'data/exhibitions')).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(`data/exhibitions/${f}`)).filter((e) => museums[e.museumId]);
const artists = readJson('data/artists.json', {});
const announcements = readJson('data/announcements.json', []);
// Shown visitor comments, exported from the database by the build workflow just before building (not kept in git).
const commentsBy = {};
for (const c of readJson('data/comments.json', [])) (commentsBy[c.exhibition_id] ??= []).push(c);
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
// Pages marked noindex are left out of the sitemap too.
// lastmod tells Google which pages changed, so updated pages are crawled again sooner.
const lastmods = {};
const page = (path, html, lastmod) => { write(`${path.replace(/^\//, '')}index.html`, html); if (!html.includes('<meta name="robots" content="noindex">')) { urls.push(path); if (lastmod) lastmods[path] = lastmod; } };
// When an exhibition's page content last changed: first seen, or given its description.
const touched = (e) => [e.firstSeenAt, e.describedAt].filter(Boolean).sort().pop();
const latest = (xs) => xs.filter(Boolean).sort().pop();

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
  const represented = Object.values(museums).filter((m) => m.represents?.includes(slug));
  page(`/artists/${slug}/`, artistPage({ site, slug, ctx, shows, recs: recommend(slug, profiles), genres: [...profiles[slug].genres], lineUrl, represented }), latest([artists[slug].profileCheckedAt, ...shows.map(touched)]));
}
page('/artists/', indexPage({ site, path: '/artists/', title: '作家一覧', html: `<p class="lede">${artistSlugs.length}人の作家の展覧会を掲載しています。</p><ul class="chips">${artistSlugs.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(artists[s].name)}</a></li>`).join('')}</ul>` }));

// Museums
const museumList = Object.values(museums).sort((a, b) => AREAS.findIndex(([k]) => k === a.area) - AREAS.findIndex(([k]) => k === b.area) || a.name.localeCompare(b.name, 'ja'));
for (const m of museumList) {
  const shows = exhibitions.filter((e) => e.museumId === m.id).sort(byStart);
  const nearby = museumList.filter((n) => n.prefecture === m.prefecture && n.id !== m.id).slice(0, 12);
  page(`/museums/${m.id}/`, museumPage({ site, m, ctx, shows, nearby }), latest([m.describedAt, m.infoCheckedAt, ...shows.map(touched)]));
}
// One list per kind (museums, then galleries), each grouped by area.
const venueChips = (ms) => `<ul class="chips">${ms.map((m) => `<li><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a></li>`).join('')}</ul>`;
page('/museums/', indexPage({ site, path: '/museums/', title: '美術館・ギャラリー一覧', html: `<p class="museum-group">地域ごとの開催中の展覧会</p><ul class="chips">${AREAS.map(([k, label]) => `<li><a href="/areas/${k}/">${esc(label)}</a></li>`).join('')}</ul>` + [['museum', '美術館'], ['gallery', 'ギャラリー']].map(([kind, kindLabel]) => {
  const ofKind = museumList.filter((m) => (m.kind ?? 'museum') === kind);
  if (!ofKind.length) return '';
  return `<h2>${kindLabel}（${ofKind.length}）</h2>` + AREAS.map(([k, label]) => {
    const ms = ofKind.filter((m) => m.area === k);
    return ms.length ? `<p class="museum-group">${esc(label)}</p>${venueChips(ms)}` : '';
  }).join('');
}).join('') + '<p class="more-venues">載っていない美術館・ギャラリーは <a href="/request/">リクエスト</a> してください。</p>' }));
page('/request/', requestPage({ site }));

// Area pages: what is on in each region, grouped by prefecture.
for (const [area, label] of AREAS) {
  const shows = live.filter((e) => museums[e.museumId].area === area);
  const prefs = [...new Set(museumList.filter((m) => m.area === area).map((m) => m.prefecture))]
    .map((p) => [p, shows.filter((e) => museums[e.museumId].prefecture === p)]).filter(([, xs]) => xs.length);
  page(`/areas/${area}/`, areaPage({ site, area, label, prefs, ctx, description: `${label}（${prefs.map(([p]) => p).join('・')}）の美術館・ギャラリーで開催中・開催予定の展覧会${shows.length}件。会期と会場、作家から探せます。` }));
}

// Monthly round-ups: what opens and closes each month, from the site's first month to two months ahead.
const monthKey = (d) => d.slice(0, 7);
const addMonth = (ym, k) => { const d = new Date(`${ym}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); };
const months = [];
for (let ym = site.firstMonth ?? '2026-10'; ym <= addMonth(monthKey(today), 2); ym = addMonth(ym, 1)) months.push(ym);
const monthIndex = [];
months.forEach((ym, i) => {
  const opening = exhibitions.filter((e) => monthKey(e.startDate) === ym).sort(byStart);
  const closing = exhibitions.filter((e) => monthKey(e.endDate) === ym && monthKey(e.startDate) !== ym).sort((a, b) => a.endDate.localeCompare(b.endDate) || a.title.localeCompare(b.title));
  const ongoing = exhibitions.filter((e) => monthKey(e.startDate) < ym && monthKey(e.endDate) > ym).length;
  const note = readJson(`data/monthly/${ym}.json`, {});
  monthIndex.push([ym, opening.length, closing.length]);
  page(`/monthly/${ym}/`, monthlyPage({ site, ym, ctx, opening, closing, ongoing, intro: note.intro, prev: months[i - 1], next: months[i + 1] }), latest([note.writtenAt, ...opening.map(touched)]));
});
page('/monthly/', indexPage({ site, path: '/monthly/', title: '月別の展覧会', html: `<p class="lede">月ごとに、始まる展覧会と終わる展覧会をまとめています。</p><ul class="rows">${[...monthIndex].reverse().map(([ym, o, c]) => `<li><span class="what"><a href="/monthly/${ym}/">${+ym.slice(0, 4)}年${+ym.slice(5)}月の展覧会</a><span class="meta">始まる展覧会${o}件・終わる展覧会${c}件</span></span></li>`).join('')}</ul>` }));

// Exhibitions, each with a one-event calendar file for "add to my calendar".
const gcal = (e) => googleCalendarUrl(e, { museum: museums[e.museumId], siteUrl: site.baseUrl });
for (const e of exhibitions) {
  const otherVenues = exhibitions.filter((o) => isSameTour(e, o)).sort(byStart);
  const shown = new Set([e.id, ...otherVenues.map((o) => o.id)]);
  const pick = (xs, n) => { const out = xs.filter((o) => !shown.has(o.id)).slice(0, n); out.forEach((o) => shown.add(o.id)); return out; };
  const sameArtists = pick(live.filter((o) => o.artists.some((s) => e.artists.includes(s))), 6);
  const sameVenue = pick(live.filter((o) => o.museumId === e.museumId), 6);
  const nearby = pick(live.filter((o) => museums[o.museumId].prefecture === museums[e.museumId].prefecture), 6);
  const comments = commentsBy[e.id] ?? [];
  page(`/exhibitions/${e.id}/`, exhibitionPage({ site, e, ctx, otherVenues, googleUrl: gcal(e), icsUrl: `/exhibitions/${e.id}.ics`, sameArtists, sameVenue, nearby, comments }), latest([touched(e), comments[0]?.created_at?.slice(0, 10)]));
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
${site.moshimoRakuten?.a_id && !site.moshimoRakuten.paused ? '<h2>広告について</h2><p>当サイトはもしもアフィリエイトを通じて楽天市場などのアフィリエイトに参加しています。「PR」と表示したリンクから商品を購入されると、当サイトに紹介料が支払われることがあります。掲載する展覧会の情報や順番は、広告とは関係なく決めています。</p>' : ''}
<h2>運営</h2><p>運営: ${esc(site.operator)}　連絡先: ${esc(site.contactEmail)}</p>` }));
page('/privacy/', indexPage({ site, path: '/privacy/', title: 'プライバシー', html: '<ul><li>LINEでの通知のために、LINEのユーザーID（LINEが発行する識別番号）と登録した作家だけを保存します。お名前やプロフィールは保存しません。友だちを解除すると通知は止まります。</li><li>カレンダーへの予定の追加はお使いのカレンダーアプリ側で行われ、当サイトが予定の内容を受け取ることはありません。</li><li>アクセス解析には Cookie を使わない方式を使います。</li>' + (site.adsenseClient ? '<li>広告配信に Google AdSense を使っています。Google などの広告配信事業者は、Cookie を使ってこのサイトや他のサイトへのアクセス情報にもとづく広告を表示することがあります。パーソナライズ広告は <a href="https://adssettings.google.com/" rel="noopener">Google の広告設定</a> で無効にできます。詳しくは <a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">Google の広告に関するポリシー</a> をご覧ください。</li>' : '') + (site.moshimoRakuten?.a_id && !site.moshimoRakuten.paused ? '<li>「PR」と表示したリンクはアフィリエイトのリンクです。リンク先で、もしもアフィリエイトや楽天が Cookie を使うことがあります。</li>' : '') + '</ul>' }));

cpSync(join(root, 'public'), dist, { recursive: true });
// ads.txt: declares which ad network may sell this site's ad space (AdSense checks it).
if (site.adsenseClient) write('ads.txt', `google.com, ${site.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
write('robots.txt', site.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n# Form and bot endpoints answer only POST; a crawler's GET gets 4xx.\nDisallow: /api/\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(site.baseUrl + u)}</loc>${lastmods[u] ? `<lastmod>${lastmods[u]}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
console.log(`built ${urls.length} pages: ${artistSlugs.length} artists, ${museumList.length} museums, ${exhibitions.length} exhibitions (${live.length} current or upcoming)`);
