// HTML templates. Plain strings; every value from data goes through esc().
import { statusOn } from './exhibitions.mjs';
import { WHEN, SORTS } from './filter.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function jaDate(iso, { weekday = false } = {}) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日${weekday ? `（${WD[d.getUTCDay()]}）` : ''}`;
}
const period = (e) => `${jaDate(e.startDate)} 〜 ${jaDate(e.endDate)}`;
const STATUS = { current: '開催中', upcoming: '開催予定', past: '終了' };

// Logo mark: two corner brackets (a frame on a wall) and the notification dot.
export const MARK = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M0 0h30v6H6v20H0z" fill="currentColor"/><path d="M64 30v34H24v-6h34V30z" fill="currentColor"/><circle cx="57.5" cy="6.5" r="6.5" fill="#D56850"/></svg>';
const lineAddUrl = (site) => (site.lineBasicId ? `https://line.me/R/ti/p/${encodeURIComponent(site.lineBasicId)}` : null);

// Share buttons: plain links (no third-party scripts), plus copy / the phone's own share sheet.
function shareBox(site, path, title) {
  const url = site.baseUrl + path;
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(path === '/' ? `${site.name}｜好きな作家の展覧会が決まったら、LINEでお知らせ` : title);
  return `<aside class="share" aria-label="このページを紹介する"><p class="share-title">${path === '/' ? 'ArtPingを友だちに紹介する' : 'このページを紹介する'}</p>
<div class="share-btns">
<a class="sb x" href="https://twitter.com/intent/tweet?text=${t}&amp;url=${u}" target="_blank" rel="noopener" aria-label="Xでシェア" title="Xでシェア"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg></a>
<a class="sb line" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener" aria-label="LINEで送る" title="LINEで送る"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></a>
<a class="sb fb" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="Facebookでシェア" title="Facebookでシェア"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a>
<button type="button" class="sb copy" data-url="${esc(url)}" data-title="${esc(title)}" aria-label="リンクをコピー" title="リンクをコピー"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/></svg></button><span class="copied" hidden>コピーしました</span>
</div></aside>
<script>document.querySelectorAll('.sb.copy').forEach((b) => b.addEventListener('click', async () => {
  if (navigator.share && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ title: b.dataset.title, url: b.dataset.url }); return; } catch {} }
  try { await navigator.clipboard.writeText(b.dataset.url); b.nextElementSibling.hidden = false; } catch { prompt('このURLをコピーしてください', b.dataset.url); }
}));</script>`;
}

function layout({ site, title, path, description, body, wide = false }) {
  const full = path === '/' ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
  const line = lineAddUrl(site);
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description ?? site.tagline)}">
${site.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(site.baseUrl + path)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="${path === '/' ? 'website' : 'article'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description ?? site.tagline)}">
<meta property="og:url" content="${esc(site.baseUrl + path)}">
<meta property="og:image" content="${esc(site.baseUrl)}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap">
<link rel="stylesheet" href="/assets/style.css">
</head><body>
<header class="top"><div class="top-in">
<a class="brand" href="/">${MARK}<span>${esc(site.name)}</span></a><span class="brand-sub">展覧会情報検索 × 通知サービス</span>
<nav><a href="/search/">探す</a><a href="/artists/">作家</a><a href="/museums/">美術館</a></nav>
${line ? `<a class="btn line small" href="${esc(line)}" rel="nofollow">LINEで受け取る</a>` : ''}
</div></header>
<main${wide ? ' class="wide"' : ''}>${body}${shareBox(site, path, full)}</main>
<footer><div class="foot-in"><span class="foot-brand">${esc(site.name)}</span>
<p>展覧会情報は各美術館の公式サイトをもとに自動で集めています。お出かけ前に必ず公式サイトをご確認ください。</p>
<p><a href="/about/">このサイトについて</a> · <a href="/privacy/">プライバシー</a></p></div></footer>
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

// Page title framed by the logo's two corner brackets.
const pageHead = (kicker, title, sub = '', extra = '') => `<div class="page-head"><p class="kicker">${kicker}</p><h1>${title}${sub ? `<small>${sub}</small>` : ''}</h1>${extra}</div>`;

// Affiliate links via もしもアフィリエイト (楽天市場). Shown only when site.moshimoRakuten is set; always labeled PR.
export const moshimoLink = (m, url) => `https://af.moshimo.com/af/c/click?a_id=${encodeURIComponent(m.a_id)}&p_id=${encodeURIComponent(m.p_id)}&pc_id=${encodeURIComponent(m.pc_id)}&pl_id=${encodeURIComponent(m.pl_id)}&url=${encodeURIComponent(url)}`;
function shopBox(site, name) {
  const m = site.moshimoRakuten;
  if (!m?.a_id) return '';
  const books = `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(name)}&g=001`;
  return `<div class="shop box"><p><span class="pr">PR</span><strong>${esc(name)}の画集・図録</strong><br><span class="meta">展覧会の前後に、作品集で予習・復習を。</span></p>
<a class="btn alt" href="${esc(moshimoLink(m, books))}" rel="sponsored nofollow noopener" referrerpolicy="no-referrer-when-downgrade">楽天ブックスでさがす</a></div>`;
}

function lineBox(name, lineUrl) {
  return `<div class="subscribe"><p><strong>${esc(name)}の新しい展覧会をLINEでお知らせ</strong><br>展覧会が決まると通知が届き、そこから自分のカレンダーに予定を追加できます。</p>
${lineUrl ? `<a class="btn line" href="${esc(lineUrl)}" rel="nofollow">LINEで通知を受け取る</a><p class="hint">LINEが開いたら、そのまま送信してください。</p>` : '<p class="soon">LINEでのお知らせは準備中です。</p>'}</div>`;
}

export function homePage({ site, ctx, recent, endingSoon, upcoming, topArtists }) {
  const count = Object.values(ctx.museums).filter((m) => m.status !== 'closed').length;
  const line = lineAddUrl(site);
  const step = (n, h, p) => `<li><span class="num">${n}</span><h3>${h}</h3><p>${p}</p></li>`;
  return layout({ site, path: '/', wide: true, body: `
<section class="hero">
<div class="hero-panel"><span class="ping" aria-hidden="true"></span>
<div class="hero-labels"><span>EXHIBITION ALERTS</span><span>全国${count}館の公式発表を、毎朝チェック</span></div>
<h1 class="catch">お気に入りの作家の<br>展覧会情報を、<br><em>自動でお知らせ。</em></h1>
<button type="button" class="btn ink big" data-open="about">ArtPingについてもっと詳しく <span aria-hidden="true">→</span></button>
</div>
<div class="hero-search"><p class="tag"><i aria-hidden="true"></i>条件で探して、そのまま通知に登録</p>
<form action="/search/" class="search-big" role="search"><input name="q" type="search" placeholder="作家名・展覧会名・美術館名でさがす（例：吉田博）" aria-label="作家名・展覧会名・美術館名でさがす"><button>さがす</button></form>
<p class="more-search">地域・ジャンル・会期で絞り込む → <a href="/search/">くわしく検索</a></p></div>
</section>
<dialog id="about" class="about" aria-labelledby="about-h">
<form method="dialog"><button class="close" aria-label="閉じる">×</button></form>
<p class="kicker">HOW ArtPing WORKS</p>
<h2 id="about-h">3ステップで、もう見逃さない。</h2>
<p>ArtPingは毎朝、全国${count}館の美術館の公式発表を確認しています。登録した作家や条件に合う展覧会が見つかると、その日のうちにLINEでお知らせします。</p>
<ol class="steps">
${step('01', 'さがす', '作家名・展覧会名・美術館名、地域やジャンルで、全国の展覧会をまとめてさがせます。')}
${step('02', 'LINEで登録', '気になる作家や検索条件をLINEで送るだけ。会員登録もアプリもいりません。')}
${step('03', '新着情報が届く', '新しい展覧会が発表された日にLINEでお知らせ。ボタンひとつでカレンダーに予定が入ります。')}
</ol>
<p class="about-cta">${line ? `<a class="btn line" href="${esc(line)}" rel="nofollow">LINEで友だち追加</a>` : ''}<a class="btn alt" href="/search/">展覧会をさがしてみる</a></p>
</dialog>
<script>document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open).showModal()));</script>
<div class="home-lists">
<h2>新しく発表された展覧会</h2>${list(recent, ctx)}
<h2>まもなく終了</h2>${list(endingSoon, ctx)}
<h2>これから始まる展覧会</h2>${list(upcoming, ctx)}
<h2>展覧会の多い作家</h2><ul class="chips">${topArtists.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(ctx.artists[s].name)}</a></li>`).join('')}</ul>
</div>` });
}

export function artistPage({ site, slug, ctx, shows, recs, genres, lineUrl }) {
  const a = ctx.artists[slug];
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  return layout({ site, path: `/artists/${slug}/`, title: `${a.name}の展覧会`, description: `${a.name}${a.nameRomaji ? `（${a.nameRomaji}）` : ''}の開催中・開催予定の展覧会と、カレンダー登録。`, body: `
${pageHead('ARTIST', esc(a.name), esc(a.nameRomaji ?? ''), genres.length ? `<div class="tags">${genres.map((g) => `<a href="/search/?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>` : '')}
${lineBox(a.name, lineUrl)}
<h2>開催中</h2>${list(by('current'), ctx)}
<h2>開催予定</h2>${list(by('upcoming'), ctx)}
${shopBox(site, a.name)}
${by('past').length ? `<h2>過去の展覧会</h2>${list(by('past').reverse(), ctx)}` : ''}
${recs.length ? `<h2>${esc(a.name)}が好きな人におすすめの作家</h2><ul class="chips">${recs.map((r) => `<li><a href="/artists/${esc(r.slug)}/">${esc(ctx.artists[r.slug].name)}</a></li>`).join('')}</ul>` : ''}` });
}

export function museumPage({ site, m, ctx, shows }) {
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  return layout({ site, path: `/museums/${m.id}/`, title: `${m.name}の展覧会`, description: `${m.name}（${m.prefecture}${m.city}）の開催中・開催予定の展覧会。`, body: `
${pageHead('MUSEUM', esc(m.name), esc(m.prefecture) + esc(m.city), `<p class="head-links"><a href="${esc(m.officialUrl)}" rel="noopener">公式サイト</a><a href="${esc(m.exhibitionsUrl)}" rel="noopener">公式の展覧会一覧</a></p>`)}
${m.status === 'closed' ? '<p class="note">現在休館中です。</p>' : ''}
<h2>開催中</h2>${list(by('current'), ctx, { showMuseum: false })}
<h2>開催予定</h2>${list(by('upcoming'), ctx, { showMuseum: false })}` });
}

export function exhibitionPage({ site, e, ctx, otherVenues, googleUrl, icsUrl }) {
  const m = ctx.museums[e.museumId];
  const st = statusOn(e, ctx.today);
  return layout({ site, path: `/exhibitions/${e.id}/`, title: `${e.title}（${m.name}）`, description: `${e.title}。${m.name}にて${period(e)}。${e.summary}`, body: `
${pageHead(`EXHIBITION · <a href="/museums/${esc(m.id)}/">${esc(m.name)}</a>`, esc(e.title), '', `<p class="head-date"><span class="badge ${st}">${STATUS[st]}</span> ${period(e)}</p>`)}
<p>${esc(e.summary)}</p>
<dl class="facts box"><dt>会場</dt><dd><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a>（${esc(m.prefecture)}${esc(m.city)}）</dd>
${e.artists.length ? `<dt>作家</dt><dd>${e.artists.map((s) => `<a href="/artists/${esc(s)}/">${esc(ctx.artists[s]?.name ?? s)}</a>`).join('、')}</dd>` : ''}
${e.genres.length ? `<dt>ジャンル</dt><dd>${e.genres.map(esc).join('、')}</dd>` : ''}</dl>
<p class="actions"><a class="btn" href="${esc(e.detailUrl ?? m.exhibitionsUrl)}" rel="noopener">公式サイトで詳細を見る</a>${st !== 'past' ? `<a class="btn alt" href="${esc(googleUrl)}" rel="nofollow">Googleカレンダーに追加</a><a class="btn alt" href="${esc(icsUrl)}" rel="nofollow">iPhoneのカレンダーに追加</a>` : ''}</p>
${e.artists.length ? `<p class="hint">作家ページからLINEで登録すると、その作家の次の展覧会が決まったときにお知らせが届きます。</p>` : ''}
${otherVenues.length ? `<h2>ほかの会場（巡回）</h2>${list(otherVenues, ctx)}` : ''}` });
}

export function searchPage({ site, genres, prefsByArea, museums, lineBasicId }) {
  const chip = (name, value, label) => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(value)}"><span>${esc(label)}</span><small data-count="${name}:${esc(value)}"></small></label>`;
  // Each kind of condition folds into one row; the row shows what is chosen.
  const facet = (key, label, body, hint = '') => `<details class="facet" data-facet="${key}"><summary><span class="facet-name">${label}</span><span class="facet-val" data-sel="${key}">指定なし</span></summary><div class="facet-panel">${hint ? `<p class="hint">${hint}</p>` : ''}${body}</div></details>`;
  return layout({ site, path: '/search/', title: '展覧会を探す', description: '全国の美術館の展覧会を、地域・ジャンル・会期・作家名で絞り込めます。条件をLINEに登録すると、合う展覧会が発表されたときにお知らせします。', body: `
${pageHead('SEARCH', '展覧会を探す')}
<form id="filters" class="search" data-line="${esc(lineBasicId ?? '')}">
<div class="search-big"><input name="q" type="search" placeholder="作家名・展覧会名・美術館名" aria-label="キーワード"><button type="submit">さがす</button></div>
<div class="facets">
${facet('area', '地域', prefsByArea.map(([k, label, prefs]) => `<div class="area-row">${chip('area', k, label)}<span class="prefs">${prefs.map((p) => chip('pref', p, p)).join('')}</span></div>`).join(''), '地方ごと、または都道府県ごとに選べます。いくつ選んでもOKです。')}
${facet('genre', 'ジャンル', `<div class="chip-row">${genres.map((g) => chip('genre', g, g)).join('')}</div>`, 'いくつ選んでもOKです。地域と組み合わせると、両方に当てはまる展覧会に絞り込みます。')}
${facet('when', '時期', `<div class="when"><select name="when" aria-label="時期">${WHEN.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
<span class="range"><input type="date" name="from" aria-label="この日から"> 〜 <input type="date" name="to" aria-label="この日まで"></span>
<label class="check"><input type="checkbox" name="special" value="1"> 企画展のみ（コレクション展を除く）</label></div>`)}
${facet('museum', '美術館', prefsByArea.map(([k, label]) => { const ms = museums.filter((m) => m.area === k); return ms.length ? `<p class="museum-group">${esc(label)}</p><div class="chip-row">${ms.map((m) => chip('museum', m.id, m.name)).join('')}</div>` : ''; }).join(''))}
</div>
<div class="search-bar"><button type="submit" class="btn big" id="go">展覧会を見る</button><button type="reset" class="btn alt">条件をクリア</button>
<label class="sort">並び順 <select name="sort" aria-label="並び順">${SORTS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label></div>
</form>
<section id="result-area">
<div class="result-head"><p><strong id="count"></strong> <span id="summary" class="meta"></span></p></div>
<ul id="results" class="cards"></ul>
<button type="button" id="more" class="btn alt" hidden>もっと見る</button>
<div id="alert" class="alert" hidden>
<p><span class="dot" aria-hidden="true"></span>この条件に合う展覧会が<strong>新しく発表されたら</strong>、LINEでお知らせします。</p>
<div class="alert-actions"><a id="alert-line" class="btn line" href="#">この条件をLINEで受け取る</a><button type="button" id="copy-link" class="btn alt">URLをコピー</button></div>
</div>
</section>
<noscript><p class="note">検索には JavaScript を有効にしてください。</p></noscript>
<script type="module" src="/assets/search.js"></script>` });
}

export function indexPage({ site, path, title, html }) {
  return layout({ site, path, title, body: `${pageHead('ArtPing', esc(title))}${html}` });
}

