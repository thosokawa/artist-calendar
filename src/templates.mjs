// HTML templates. Plain strings; every value from data goes through esc().
import { statusOn } from './exhibitions.mjs';
import { subscribeLinks } from './ics.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function jaDate(iso, { weekday = false } = {}) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日${weekday ? `（${WD[d.getUTCDay()]}）` : ''}`;
}
const period = (e) => `${jaDate(e.startDate)} 〜 ${jaDate(e.endDate)}`;
const STATUS = { current: '開催中', upcoming: '開催予定', past: '終了' };

function layout({ site, title, path, description, body }) {
  const full = path === '/' ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description ?? site.tagline)}">
${site.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(site.baseUrl + path)}">
<link rel="stylesheet" href="/assets/style.css">
</head><body>
<header class="top"><a class="brand" href="/">${esc(site.name)}</a><nav><a href="/search/">探す</a><a href="/artists/">作家</a><a href="/museums/">美術館</a></nav></header>
<main>${body}</main>
<footer><p>展覧会情報は各美術館の公式サイトをもとに自動で集めています。お出かけ前に必ず公式サイトをご確認ください。</p>
<p><a href="/about/">このサイトについて</a> · <a href="/privacy/">プライバシー</a></p></footer>
</body></html>
`;
}

function card(e, { museums, artists, today, showMuseum = true }) {
  const m = museums[e.museumId];
  const st = statusOn(e, today);
  const names = e.artists.map((s) => `<a href="/artists/${esc(s)}/">${esc(artists[s]?.name ?? s)}</a>`).join('、');
  return `<li class="card"><span class="badge ${st}">${STATUS[st]}</span>
<a class="title" href="/exhibitions/${esc(e.id)}/">${esc(e.title)}</a>
<div class="meta">${showMuseum ? `${esc(m?.name)}（${esc(m?.prefecture)}） · ` : ''}${period(e)}</div>
${names ? `<div class="artists">${names}</div>` : ''}
${e.genres.length ? `<div class="tags">${e.genres.map((g) => `<a href="/search/?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>` : ''}</li>`;
}
const list = (items, ctx, opts) => (items.length ? `<ul class="cards">${items.map((e) => card(e, { ...ctx, ...opts })).join('')}</ul>` : '<p class="empty">いまのところありません。</p>');

function subscribeBox(site, icsPath, label) {
  const l = subscribeLinks(site.baseUrl + icsPath);
  return `<div class="subscribe"><p><strong>${esc(label)}</strong><br>一度追加すると、新しい展覧会が決まるたびにカレンダーへ自動で入ります（開幕日と、終了1週間前）。</p>
<a class="btn" href="${esc(l.google)}" rel="nofollow">Googleカレンダーに追加</a>
<a class="btn alt" href="${esc(l.webcal)}" rel="nofollow">iPhone・Macのカレンダーに追加</a>
<details><summary>その他のカレンダー</summary><p>購読用URL: <code>${esc(l.ics)}</code></p></details>
<p class="soon">LINEでのお知らせは準備中です。</p></div>`;
}

export function homePage({ site, ctx, recent, endingSoon, upcoming, topArtists }) {
  return layout({ site, path: '/', body: `
<section class="hero"><h1>${esc(site.tagline)}</h1><p>好きな作家を登録しておくと、その作家の展覧会が決まったときにカレンダーへ自動で入ります。全国の主要美術館の公式発表をもとに更新しています。</p>
<form action="/search/" class="search-mini"><input name="q" placeholder="作家名・展覧会名で探す" aria-label="作家名・展覧会名で探す"><button>探す</button></form></section>
<h2>新しく発表された展覧会</h2>${list(recent, ctx)}
<h2>まもなく終了</h2>${list(endingSoon, ctx)}
<h2>これから始まる展覧会</h2>${list(upcoming, ctx)}
<h2>展覧会の多い作家</h2><ul class="chips">${topArtists.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(ctx.artists[s].name)}</a></li>`).join('')}</ul>` });
}

export function artistPage({ site, slug, ctx, shows, recs, genres }) {
  const a = ctx.artists[slug];
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  return layout({ site, path: `/artists/${slug}/`, title: `${a.name}の展覧会`, description: `${a.name}${a.nameRomaji ? `（${a.nameRomaji}）` : ''}の開催中・開催予定の展覧会と、カレンダー登録。`, body: `
<h1>${esc(a.name)}<small>${esc(a.nameRomaji ?? '')}</small></h1>
${genres.length ? `<div class="tags">${genres.map((g) => `<a href="/search/?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>` : ''}
${subscribeBox(site, `/artists/${slug}.ics`, `${a.name}の展覧会をカレンダーに`)}
<h2>開催中</h2>${list(by('current'), ctx)}
<h2>開催予定</h2>${list(by('upcoming'), ctx)}
${by('past').length ? `<h2>過去の展覧会</h2>${list(by('past').reverse(), ctx)}` : ''}
${recs.length ? `<h2>${esc(a.name)}が好きな人におすすめの作家</h2><ul class="chips">${recs.map((r) => `<li><a href="/artists/${esc(r.slug)}/">${esc(ctx.artists[r.slug].name)}</a></li>`).join('')}</ul>` : ''}` });
}

export function museumPage({ site, m, ctx, shows }) {
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  return layout({ site, path: `/museums/${m.id}/`, title: `${m.name}の展覧会`, description: `${m.name}（${m.prefecture}${m.city}）の開催中・開催予定の展覧会。`, body: `
<h1>${esc(m.name)}<small>${esc(m.prefecture)}${esc(m.city)}</small></h1>
<p><a href="${esc(m.officialUrl)}" rel="noopener">公式サイト</a> · <a href="${esc(m.exhibitionsUrl)}" rel="noopener">公式の展覧会一覧</a></p>
${m.status === 'closed' ? '<p class="note">現在休館中です。</p>' : ''}
${subscribeBox(site, `/museums/${m.id}.ics`, `${m.name}の展覧会をカレンダーに`)}
<h2>開催中</h2>${list(by('current'), ctx, { showMuseum: false })}
<h2>開催予定</h2>${list(by('upcoming'), ctx, { showMuseum: false })}` });
}

export function exhibitionPage({ site, e, ctx, otherVenues, googleUrl }) {
  const m = ctx.museums[e.museumId];
  const st = statusOn(e, ctx.today);
  return layout({ site, path: `/exhibitions/${e.id}/`, title: `${e.title}（${m.name}）`, description: `${e.title}。${m.name}にて${period(e)}。${e.summary}`, body: `
<p class="crumbs"><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a></p>
<h1>${esc(e.title)}</h1>
<p><span class="badge ${st}">${STATUS[st]}</span> ${period(e)}</p>
<p>${esc(e.summary)}</p>
<dl class="facts"><dt>会場</dt><dd><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a>（${esc(m.prefecture)}${esc(m.city)}）</dd>
${e.artists.length ? `<dt>作家</dt><dd>${e.artists.map((s) => `<a href="/artists/${esc(s)}/">${esc(ctx.artists[s]?.name ?? s)}</a>`).join('、')}</dd>` : ''}
${e.genres.length ? `<dt>ジャンル</dt><dd>${e.genres.map(esc).join('、')}</dd>` : ''}</dl>
<p><a class="btn" href="${esc(e.detailUrl ?? m.exhibitionsUrl)}" rel="noopener">公式サイトで詳細を見る</a>
${st !== 'past' ? `<a class="btn alt" href="${esc(googleUrl)}" rel="nofollow">この展覧会だけGoogleカレンダーに追加</a>` : ''}</p>
${e.artists.length ? `<p class="hint">作家ページから登録すると、次の展覧会も自動でカレンダーに入ります。</p>` : ''}
${otherVenues.length ? `<h2>ほかの会場（巡回）</h2>${list(otherVenues, ctx)}` : ''}` });
}

export function searchPage({ site, genres, areas }) {
  return layout({ site, path: '/search/', title: '展覧会を探す', body: `
<h1>展覧会を探す</h1>
<form id="filters" class="filters">
<input name="q" placeholder="作家名・展覧会名・美術館名" aria-label="キーワード">
<select name="area" aria-label="地域"><option value="">すべての地域</option>${areas.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
<select name="genre" aria-label="ジャンル"><option value="">すべてのジャンル</option>${genres.map((g) => `<option>${esc(g)}</option>`).join('')}</select>
<select name="when" aria-label="時期"><option value="">開催中と開催予定</option><option value="current">開催中</option><option value="upcoming">開催予定</option><option value="month">今月開催中のもの</option></select>
<label><input type="checkbox" name="special" value="1"> 企画展のみ</label>
</form>
<p id="count" class="count"></p><ul id="results" class="cards"></ul>
<script src="/assets/search.js" defer></script>` });
}

export function indexPage({ site, path, title, html }) {
  return layout({ site, path, title, body: `<h1>${esc(title)}</h1>${html}` });
}
