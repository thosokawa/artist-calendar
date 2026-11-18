// HTML templates. Plain strings; every value from data goes through esc().
import { statusOn } from './exhibitions.mjs';
import { SNS_KINDS, SNS_LABEL } from './sns.mjs';
import { WHEN, SORTS, VENUES, AREAS } from './filter.mjs';

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
  const text = path === '/' ? `${site.name}｜好きな作家の新しい展覧会を、LINEでお知らせ` : title;
  const t = encodeURIComponent(text);
  const lt = encodeURIComponent(`${text}\n${url}`);
  return `<aside class="share" aria-label="このページを紹介する"><p class="share-title">${path === '/' ? 'ArtPingを友だちに紹介する' : 'このページを紹介する'}</p>
<div class="share-btns">
<a class="sb x" href="https://twitter.com/intent/tweet?text=${t}&amp;url=${u}" target="_blank" rel="noopener" aria-label="Xでシェア" title="Xでシェア"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg></a>
<a class="sb line" href="https://line.me/R/share?text=${lt}" target="_blank" rel="noopener" aria-label="LINEで送る" title="LINEで送る"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></a>
<a class="sb fb" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="Facebookでシェア" title="Facebookでシェア"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a>
<button type="button" class="sb copy" data-url="${esc(url)}" data-title="${esc(title)}" aria-label="リンクをコピー" title="リンクをコピー"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/></svg></button><span class="copied" hidden>コピーしました</span>
</div></aside>
<script>document.querySelectorAll('.sb.copy').forEach((b) => b.addEventListener('click', async () => {
  if (navigator.share && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ title: b.dataset.title, url: b.dataset.url }); return; } catch {} }
  try { await navigator.clipboard.writeText(b.dataset.url); b.nextElementSibling.hidden = false; } catch { prompt('このURLをコピーしてください', b.dataset.url); }
}));
// On phones the Facebook web sharer asks for a browser login, so hand off to the phone's share sheet (it lists the Facebook app).
document.querySelectorAll('.sb.fb').forEach((a) => a.addEventListener('click', async (e) => {
  if (!(navigator.share && matchMedia('(pointer:coarse)').matches)) return;
  e.preventDefault(); const c = a.parentElement.querySelector('.sb.copy');
  try { await navigator.share({ title: c.dataset.title, url: c.dataset.url }); } catch (err) { if (err.name !== 'AbortError') location.href = a.href; }
}));</script>`;
}

function layout({ site, title, path, description, body, wide = false, noindex = false }) {
  const full = path === '/' ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
  const line = lineAddUrl(site);
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description ?? site.tagline)}">
${site.noindex || noindex ? '<meta name="robots" content="noindex">' : ''}
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
<link rel="stylesheet" href="/assets/style.css${site.cssVersion ? `?v=${site.cssVersion}` : ''}">
${site.adsenseClient ? `<meta name="google-adsense-account" content="${esc(site.adsenseClient)}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(site.adsenseClient)}" crossorigin="anonymous"></script>` : ''}
</head><body>
<header class="top"><div class="top-in">
<a class="brand" href="/">${MARK}<span>${esc(site.name)}</span></a><span class="brand-sub">展覧会情報検索 × 通知サービス</span>
<nav><a href="/search/">探す</a><a href="/artists/">作家</a><a href="/museums/">美術館・画廊</a></nav>
${line ? `<a class="btn line small" href="${esc(line)}" rel="nofollow" data-track="line-header">新着展覧会をLINEで通知</a>` : ''}
</div></header>
<main${wide ? ' class="wide"' : ''}>${body}${shareBox(site, path, full)}</main>
<footer><div class="foot-in"><span class="foot-brand">${esc(site.name)}</span>
<p>展覧会情報は各美術館・ギャラリーの公式サイトをもとに自動で集めています。お出かけ前に必ず公式サイトをご確認ください。</p>
<p class="areas">${AREAS.map(([k, label]) => `<a href="/areas/${k}/">${esc(label)}の展覧会</a>`).join(' · ')}</p>
<p><a href="/monthly/">月別の展覧会</a> · <a href="/about/">このサイトについて</a> · <a href="/request/">施設のリクエスト</a> · <a href="/privacy/">プライバシー</a></p></div></footer>
<script>document.addEventListener('click', (e) => { const a = e.target.closest('[data-track]'); if (a && a.getAttribute('href') && navigator.sendBeacon) navigator.sendBeacon('/api/click', JSON.stringify({ k: a.dataset.track, p: location.pathname })); });</script>
${body.includes('search-big') ? '<script type="module" src="/assets/suggest.js"></script>\n' : ''}</body></html>
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

// Compact one-line rows (date, title, venue) for timelines and schedules.
const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
const span = (e) => (e.startDate.slice(0, 4) === e.endDate.slice(0, 4) ? `${md(e.startDate)}〜${md(e.endDate)}` : `${md(e.startDate)}〜${e.endDate.slice(0, 4)}/${md(e.endDate)}`);
function rows(items, { museums, today }, { showMuseum = true } = {}) {
  return `<ul class="rows">${items.map((e) => { const st = statusOn(e, today); const m = museums[e.museumId]; return `<li><span class="when">${span(e)}</span><span class="what"><a href="/exhibitions/${esc(e.id)}/">${esc(e.title)}</a>${showMuseum ? `<span class="meta">${esc(m?.name)}</span>` : ''}</span>${st !== 'past' ? `<span class="badge ${st}">${STATUS[st]}</span>` : ''}</li>`; }).join('')}</ul>`;
}
/** Groups items into [key, items] by a key function, keeping first-seen order. */
const groupBy = (items, key) => { const g = new Map(); for (const x of items) { const k = key(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); } return [...g]; };

// Page title framed by the logo's two corner brackets.
// Official social accounts (Simple Icons, CC0), shown as a row of small icons.
const SNS_ICON = {"instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077", "x": "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z", "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z", "youtube": "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z", "tiktok": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z", "threads": "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"};
function snsRow(sns, name) {
  const links = SNS_KINDS.filter((k) => sns?.[k]).map((k) => `<a class="sns-link" href="${esc(sns[k])}" target="_blank" rel="noopener" aria-label="${esc(name)}の${SNS_LABEL[k]}" title="${SNS_LABEL[k]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${SNS_ICON[k]}"/></svg></a>`);
  return links.length ? `<span class="sns">${links.join('')}</span>` : '';
}

const pageHead = (kicker, title, sub = '', extra = '') => `<div class="page-head"><p class="kicker">${kicker}</p><h1>${title}${sub ? `<small>${sub}</small>` : ''}</h1>${extra}</div>`;

// Affiliate links via もしもアフィリエイト (楽天市場). Shown only when site.moshimoRakuten is set; always labeled PR.
export const moshimoLink = (m, url) => `https://af.moshimo.com/af/c/click?a_id=${encodeURIComponent(m.a_id)}&p_id=${encodeURIComponent(m.p_id)}&pc_id=${encodeURIComponent(m.pc_id)}&pl_id=${encodeURIComponent(m.pl_id)}&url=${encodeURIComponent(url)}`;
function shopBox(site, name) {
  const m = site.moshimoRakuten;
  if (!m?.a_id) return '';
  const books = `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(name)}&g=001`;
  // paused: the affiliate link is not working yet, so link straight to Rakuten Books (no PR label).
  const href = m.paused ? books : moshimoLink(m, books);
  return `<div class="shop box"><p>${m.paused ? '' : '<span class="pr">PR</span>'}<strong>${esc(name)}の画集・図録</strong><br><span class="meta">展覧会の前後に、作品集で予習・復習を。過去の展覧会の図録は、フリマやオークションで見つかることもあります。</span></p>
<div class="actions"><a class="btn alt" href="${esc(href)}" rel="${m.paused ? '' : 'sponsored '}nofollow noopener" target="_blank" referrerpolicy="no-referrer-when-downgrade">楽天ブックスでさがす</a>${usedLinks(site, `${name} 図録`)}</div></div>`;
}

// Second-hand catalogues: links to search results on flea-market and auction sites (no scraping, just a search link).
// Mercari links carry the Mercari Ambassador id (afid) when one is configured.
const mercariSearch = (site, q) => `https://jp.mercari.com/search?${site.mercariAfid ? `afid=${encodeURIComponent(site.mercariAfid)}&` : ''}keyword=${encodeURIComponent(q)}&status=on_sale`;
const yahooAuctionSearch = (q) => `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(q)}`;
const usedLinks = (site, q) => `<a class="btn alt" href="${esc(mercariSearch(site, q))}" target="_blank" rel="${site.mercariAfid ? 'sponsored ' : ''}nofollow noopener">メルカリでさがす</a><a class="btn alt" href="${esc(yahooAuctionSearch(q))}" target="_blank" rel="nofollow noopener">ヤフオクでさがす</a>`;

/** The words people would list a catalogue under: the main title without its subtitle, plus 図録. */
export function catalogQuery(title) {
  const main = String(title).split(/\s[—–―‐-]{1,2}\s|[—―]{1,2}|：|:\s|\s〜|〜\s/)[0].replace(/[「」『』【】"“”]/g, ' ').replace(/\s+/g, ' ').trim();
  // Sellers rarely repeat labels like 特別展 or 生誕150年, and every extra word narrows the search.
  const core = main.replace(/^(?:(?:特別展|企画展|特別企画展|特集展示|開館\d+周年記念(?:展)?|生誕\d+年(?:記念)?|没後\d+年(?:記念)?|創立\d+周年記念)\s*)+/, '').trim();
  return `${core.length >= 2 ? core : main.length >= 2 ? main : String(title).trim()} 図録`;
}

/** Cover cards of artist books from Rakuten Books (official API data, refreshed monthly). */
function bookShelf(title, items) {
  if (!items?.length) return '';
  const ad = items.some((x) => x.affiliate);
  return `<section class="books"><h2>${esc(title)}</h2><ul class="book-grid">${items.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="${x.affiliate ? 'sponsored ' : ''}nofollow noopener" data-track="books"><img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="b-title">${esc(x.title)}</span>${x.price ? `<span class="b-price">${Number(x.price).toLocaleString('ja-JP')}円</span>` : ''}</a></li>`).join('')}</ul>
<p class="hint">${ad ? '<span class="pr">PR</span>' : ''}楽天ブックスの商品ページが開きます。価格は確認した時点のものです。</p></section>`;
}

function catalogBox(site, e, st) {
  return `<div class="shop box used"><p>${site.mercariAfid ? '<span class="pr">PR</span>' : ''}<strong>この展覧会の図録をさがす</strong><br><span class="meta">${st === 'past' ? '会期が終わった展覧会の図録は、フリマやオークションに出ていることがあります。' : '会場で売り切れた図録も、フリマやオークションに出ていることがあります。'}</span></p>
<div class="actions">${usedLinks(site, catalogQuery(e.title))}</div></div>`;
}

function lineBox(name, lineUrl) {
  return `<div class="subscribe"><div class="subscribe-in"><p><span class="dot" aria-hidden="true"></span><strong>${esc(name)}の新しい展覧会をLINEでお知らせ</strong><span class="sub">新しい展覧会が発表されたら通知が届き、そこからカレンダーに予定を追加できます。</span></p>
${lineUrl ? `<a class="btn line" href="${esc(lineUrl)}" rel="nofollow" data-track="line-artist">LINEで通知を受け取る</a>` : '<p class="soon">LINEでのお知らせは準備中です。</p>'}</div></div>`;
}

// In-page sign-up card (the fixed bar at the bottom is easy to miss on wide screens).
function notifyCard(name, lineUrl) {
  if (!lineUrl) return '';
  return `<section class="notify-card m-top" id="notify" aria-label="LINEでお知らせ"><p class="notify-title"><span class="dot" aria-hidden="true"></span>${esc(name)}の新しい展覧会を、LINEでお知らせします</p>
<ol class="notify-steps"><li><b>1</b>下のボタンでLINEを開く</li><li><b>2</b>表示されたメッセージをそのまま送信</li><li><b>3</b>新しい展覧会が発表された日に通知が届く</li></ol>
<div class="notify-foot"><p class="meta">無料・会員登録なし。通知からカレンダーに予定を追加できます。</p><a class="btn line big" href="${esc(lineUrl)}" rel="nofollow" data-track="line-artist-card">LINEで通知を受け取る</a></div></section>
<script>(() => { const c = document.getElementById('notify'), bar = document.querySelector('.subscribe'); if (!c || !bar || !window.IntersectionObserver) return;
  new IntersectionObserver(([e]) => bar.classList.toggle('away', e.isIntersecting)).observe(c); })();</script>`;
}

// PC: main column + right sidebar. Phones: one column; sidebar blocks marked m-top come before the main column.
const cols = (main, side) => `<div class="cols"><div class="col-main">${main}</div><aside class="col-side">${side}</aside></div>`;

export function homePage({ site, ctx, recent, endingSoon, upcoming, topArtists }) {
  const open = Object.values(ctx.museums).filter((m) => m.status !== 'closed');
  const galleries = open.filter((m) => m.kind === 'gallery').length;
  const count = open.length - galleries;
  const venues = galleries ? `全国の美術館${count}館・ギャラリー${galleries}軒` : `全国${count}館の美術館`;
  const line = lineAddUrl(site);
  const step = (n, h, p) => `<li><span class="num">${n}</span><h3>${h}</h3><p>${p}</p></li>`;
  return layout({ site, path: '/', wide: true, body: `
<section class="hero">
<div class="hero-panel"><span class="ping" aria-hidden="true"></span>
<div class="hero-labels"><span>EXHIBITION ALERTS</span><span>${galleries ? `美術館${count}館・ギャラリー${galleries}軒` : `全国${count}館`}の公式発表を、毎朝チェック</span></div>
<h1 class="catch">お気に入りの作家の<br>展覧会情報を、<br><em>自動でお知らせ。</em></h1>
<button type="button" class="btn ink big" data-open="about">ArtPingについてもっと詳しく <span aria-hidden="true">→</span></button>
</div>
<div class="hero-search"><p class="tag"><i aria-hidden="true"></i>条件で探して、そのまま通知に登録</p>
<form action="/search/" class="search-big" role="search"><input name="q" type="search" placeholder="作家名・展覧会名・会場名でさがす" aria-label="作家名・展覧会名・会場名でさがす"><button>さがす</button></form>
<p class="more-search">地域・ジャンル・会期で絞り込む → <a href="/search/">くわしく検索</a></p></div>
</section>
<dialog id="about" class="about" aria-labelledby="about-h">
<form method="dialog"><button class="close" aria-label="閉じる">×</button></form>
<p class="kicker">HOW ArtPing WORKS</p>
<h2 id="about-h">3ステップで、もう見逃さない。</h2>
<p>ArtPingは毎朝、${venues}の公式発表を確認しています。登録した作家や条件に合う展覧会が見つかると、その日のうちにLINEでお知らせします。</p>
<ol class="steps">
${step('01', 'さがす', '作家名・展覧会名・会場名、地域やジャンルで、全国の展覧会をまとめてさがせます。')}
${step('02', 'LINEで登録', '気になる作家や検索条件をLINEで送るだけ。会員登録もアプリもいりません。')}
${step('03', '新着情報が届く', '新しい展覧会が発表された日にLINEでお知らせ。ボタンひとつでカレンダーに予定が入ります。')}
</ol>
<p class="plan-note">無料で、作家5人・検索条件1つまで登録できます。</p>
<p class="about-cta">${line ? `<a class="btn line" href="${esc(line)}" rel="nofollow" data-track="line-about">LINEで友だち追加</a>` : ''}<a class="btn alt" href="/search/">展覧会をさがしてみる</a></p>
</dialog>
<script>document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open).showModal()));</script>
<div class="home-lists">
<h2>新しく発表された展覧会</h2>${list(recent, ctx)}
<h2>まもなく終了</h2>${list(endingSoon, ctx)}
<h2>これから始まる展覧会</h2>${list(upcoming, ctx)}
<p class="more-search"><a href="/monthly/${ctx.today.slice(0, 7)}/">${+ctx.today.slice(5, 7)}月に始まる展覧会・終わる展覧会のまとめ →</a></p>
<h2>展覧会の多い作家</h2><ul class="chips">${topArtists.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(ctx.artists[s].name)}</a></li>`).join('')}</ul>
</div>` });
}

export function artistPage({ site, slug, ctx, shows, recs, genres, lineUrl, represented = [] }) {
  const a = ctx.artists[slug];
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  const main = `<h2>開催中</h2>${list(by('current'), ctx)}
<h2>開催予定</h2>${list(by('upcoming'), ctx)}
${a.profile ? `<h2>${esc(a.name)}について</h2><p class="intro">${esc(a.profile)}</p>${a.profileUrl ? `<p class="hint">参考: <a href="${esc(a.profileUrl)}" rel="noopener">${esc(a.profileSource ?? '公式サイト')}</a></p>` : ''}` : ''}
${bookShelf(`${a.name}の画集・作品集`, ctx.books?.[slug]?.items)}
${by('past').length ? `<h2>${esc(a.name)}の過去の展覧会</h2>${by('past').length >= 2 ? groupBy([...by('past')].reverse(), (e) => e.startDate.slice(0, 4)).map(([y, xs]) => `<h3 class="year">${y}年</h3>${rows(xs, ctx)}`).join('') : list(by('past'), ctx)}` : ''}`;
  const side = `${notifyCard(a.name, lineUrl)}
${represented.length ? `<section class="side-box"><h2>取り扱いギャラリー</h2><ul class="chips">${represented.map((g) => `<li><a href="/museums/${esc(g.id)}/">${esc(g.name)}</a></li>`).join('')}</ul></section>` : ''}
${recs.length ? `<section class="side-box"><h2>${esc(a.name)}が好きな人におすすめの作家</h2><ul class="chips">${recs.map((r) => `<li><a href="/artists/${esc(r.slug)}/">${esc(ctx.artists[r.slug].name)}</a></li>`).join('')}</ul></section>` : ''}
${shopBox(site, a.name)}`;
  // With a single show and no profile the page repeats that exhibition's page; it stays out of search until it has more.
  return layout({ site, wide: true, noindex: shows.length < 2 && !a.profile, path: `/artists/${slug}/`, title: `${a.name}の展覧会`, description: `${a.name}${a.nameRomaji ? `（${a.nameRomaji}）` : ''}の開催中・開催予定の展覧会と、カレンダー登録。`, body: `
${pageHead('ARTIST', esc(a.name), esc(a.nameRomaji ?? ''), `${a.website || a.sns ? `<p class="head-links">${a.website ? `<a href="${esc(a.website)}" target="_blank" rel="noopener">公式サイト</a>` : ''}${snsRow(a.sns, a.name)}</p>` : ''}${genres.length ? `<div class="tags">${genres.map((g) => `<a href="/search/?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>` : ''}`)}
${lineBox(a.name, lineUrl)}
${cols(main, side)}` });
}

// Address, nearest station and closing days read from the venue's official access page (no prices or hours), plus a map.
function info(m) {
  if (!m.address && !m.access && !m.closed) return '';
  const q = encodeURIComponent(`${m.name} ${m.address ?? `${m.prefecture}${m.city ?? ''}`}`);
  return `<section class="side-box"><h2>アクセス</h2><dl class="facts">${m.address ? `<dt>住所</dt><dd>${esc(m.address)}</dd>` : ''}${m.access ? `<dt>交通</dt><dd>${esc(m.access)}</dd>` : ''}${m.closed ? `<dt>休館日</dt><dd>${esc(m.closed)}</dd>` : ''}</dl>
<div class="map"><iframe title="${esc(m.name)}の地図" src="https://maps.google.com/maps?q=${q}&amp;output=embed&amp;hl=ja" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
<p class="hint">開館時間・休館日は変わることがあります。お出かけ前に<a href="${esc(m.accessUrl ?? m.officialUrl)}" rel="noopener">公式サイト</a>でご確認ください。</p></section>`;
}

export function museumPage({ site, m, ctx, shows, nearby = [] }) {
  const by = (st) => shows.filter((e) => statusOn(e, ctx.today) === st);
  // How often each artist has shown here (ArtPing's own records).
  const n = {};
  for (const e of shows) for (const s of e.artists) n[s] = (n[s] ?? 0) + 1;
  const topArtists = Object.entries(n).filter(([s]) => ctx.artists[s]).map(([slug, k]) => ({ slug, n: k })).sort((a, b) => b.n - a.n || ctx.artists[a.slug].name.localeCompare(ctx.artists[b.slug].name, 'ja')).slice(0, 20);
  const represents = (m.represents ?? []).filter((s) => ctx.artists[s]);
  const line = lineAddUrl(site);
  const main = `${m.intro ? `<p class="intro">${esc(m.intro)}</p>` : ''}
${m.status === 'closed' ? '<p class="note">現在休館中です。</p>' : ''}${m.status === 'unreadable' ? '<p class="note">この施設の公式サイトは自動で読み取れないため、展覧会情報は公式サイトでご確認ください。</p>' : ''}
<h2>開催中</h2>${list(by('current'), ctx, { showMuseum: false })}
<h2>開催予定</h2>${list(by('upcoming'), ctx, { showMuseum: false })}
${shows.length ? `<h2>展覧会スケジュール</h2>${groupBy([...shows].reverse().slice(0, 36), (e) => e.startDate.slice(0, 7)).map(([ym, xs]) => `<h3 class="year">${+ym.slice(0, 4)}年${+ym.slice(5)}月開幕</h3>${rows(xs, ctx, { showMuseum: false })}`).join('')}` : ''}
${topArtists.length ? `<h2>${topArtists.some((t) => t.n > 1) ? `${esc(m.name)}でよく展示される作家` : `${esc(m.name)}で展示された作家`}</h2><ul class="chips">${topArtists.map((t) => `<li><a href="/artists/${esc(t.slug)}/">${esc(ctx.artists[t.slug]?.name ?? t.slug)}${t.n > 1 ? `<small class="n">${t.n}回</small>` : ''}</a></li>`).join('')}</ul>` : ''}
${represents.length ? `<h2>${esc(m.name)}の取り扱い作家</h2><ul class="chips">${represents.map((s) => `<li><a href="/artists/${esc(s)}/">${esc(ctx.artists[s].name)}</a></li>`).join('')}</ul>` : ''}`;
  const side = `${info(m)}
${line ? `<section class="notify-card side-notify"><p class="notify-title"><span class="dot" aria-hidden="true"></span>好きな作家の新しい展覧会を、LINEでお知らせ</p><p class="meta">LINEで友だち追加して、作家名を送るだけ。無料・会員登録なし。</p><a class="btn line" href="${esc(line)}" rel="nofollow" data-track="line-about">LINEで友だち追加</a></section>` : ''}
${nearby.length ? `<section class="side-box"><h2>${esc(m.prefecture)}のほかの美術館・ギャラリー</h2><ul class="chips">${nearby.map((x) => `<li><a href="/museums/${esc(x.id)}/">${esc(x.name)}</a></li>`).join('')}</ul></section>` : ''}`;
  return layout({ site, wide: true, path: `/museums/${m.id}/`, title: `${m.name}の展覧会`, description: `${m.name}（${m.prefecture}${m.city}）の開催中・開催予定の展覧会。`, body: `
${pageHead(m.kind === 'gallery' ? 'GALLERY' : 'MUSEUM', esc(m.name), esc(m.prefecture) + esc(m.city), `<p class="head-links"><a href="${esc(m.officialUrl)}" rel="noopener">公式サイト</a><a href="${esc(m.exhibitionsUrl)}" rel="noopener">公式の展覧会一覧</a>${snsRow(m.sns, m.name)}</p>`)}
${cols(main, side)}` });
}

function commentItem(c) {
  return `<li data-id="${esc(c.id)}"><p class="c-body">${esc(c.body).replace(/\n/g, '<br>')}</p><p class="c-meta"><span class="c-name">${esc(c.name)}</span><span>${esc(String(c.created_at).slice(0, 10).replace(/-/g, '/'))}</span><button type="button" class="c-report">通報</button></p></li>`;
}

// Visitors' impressions. Shown ones are baked into the page at build time and refreshed by /assets/comments.js.
function commentsBox(e, comments) {
  return `<section class="comments" id="comments" data-e="${esc(e.id)}" data-t="${esc(e.title)}">
<h2>みんなの感想${comments.length ? `<small class="c-count">${comments.length}件</small>` : ''}</h2>
<ul class="comment-list">${comments.map(commentItem).join('')}</ul>
<p class="c-empty"${comments.length ? ' hidden' : ''}>まだ感想はありません。行った方は、ぜひ最初の感想を書いてください。</p>
<form class="comment-form" method="post" action="/api/comments">
<input type="hidden" name="e" value="${esc(e.id)}"><input type="hidden" name="t" value="${esc(e.title)}">
<label>ニックネーム（任意）<input name="name" maxlength="20" placeholder="匿名" autocomplete="nickname"></label>
<label>感想<textarea name="body" required minlength="10" maxlength="400" rows="4" placeholder="見どころ、混み具合、よかった作品など（10〜400字）"></textarea></label>
<label class="hp" aria-hidden="true">website<input name="website" tabindex="-1" autocomplete="off"></label>
<div class="c-actions"><button type="submit" class="btn">感想を投稿する</button><span class="meta">内容を自動で確認してから掲載します。URL・個人情報は書けません。</span></div>
<p class="c-result" role="status" hidden></p>
</form></section>
<script type="module" src="/assets/comments.js"></script>`;
}

export function exhibitionPage({ site, e, ctx, otherVenues, googleUrl, icsUrl, sameVenue = [], sameArtists = [], nearby = [], comments = [] }) {
  const m = ctx.museums[e.museumId];
  const st = statusOn(e, ctx.today);
  const main = `<p>${esc(e.summary)}</p>
${e.description ? `<h2>展覧会の内容</h2><p class="intro">${esc(e.description)}</p>` : ''}
${commentsBox(e, comments)}
${bookShelf(e.artists.length === 1 ? `${ctx.artists[e.artists[0]]?.name ?? ''}の画集・作品集` : '出品作家の画集・作品集', e.artists.flatMap((x) => ctx.books?.[x]?.items ?? []).slice(0, 4))}
${otherVenues.length ? `<h2>ほかの会場（巡回）</h2>${list(otherVenues, ctx)}` : ''}
${sameArtists.length ? `<h2>同じ作家のほかの展覧会</h2>${list(sameArtists, ctx)}` : ''}
${sameVenue.length ? `<h2>${esc(m.name)}のほかの展覧会</h2>${list(sameVenue, ctx, { showMuseum: false })}` : ''}
${nearby.length ? `<h2>${esc(m.prefecture)}で開催中・開催予定の展覧会</h2>${list(nearby, ctx)}` : ''}`;
  const side = `<section class="side-box m-top"><h2>開催情報</h2><dl class="facts"><dt>会期</dt><dd>${period(e)}</dd><dt>会場</dt><dd><a href="/museums/${esc(m.id)}/">${esc(m.name)}</a>（${esc(m.prefecture)}${esc(m.city)}）</dd>
${e.artists.length ? `<dt>作家</dt><dd>${e.artists.map((s) => `<a href="/artists/${esc(s)}/">${esc(ctx.artists[s]?.name ?? s)}</a>`).join('、')}</dd>` : ''}
${e.genres.length ? `<dt>ジャンル</dt><dd>${e.genres.map(esc).join('、')}</dd>` : ''}</dl>
<p class="side-actions"><a class="btn" href="${esc(e.detailUrl ?? m.exhibitionsUrl)}" rel="noopener">公式サイトで詳細を見る</a>${st !== 'past' ? `<a class="btn alt" href="${esc(googleUrl)}" target="_blank" rel="nofollow noopener">Googleカレンダーに追加</a><a class="btn alt" href="${esc(icsUrl)}" target="_blank" rel="nofollow noopener">iPhoneのカレンダーに追加</a>` : ''}</p></section>
${e.artists.length ? `<section class="notify-card side-notify"><p class="notify-title"><span class="dot" aria-hidden="true"></span>この作家の次の展覧会を、LINEでお知らせします</p><p class="meta">作家ページの「LINEで通知を受け取る」から登録できます。無料・会員登録なし。</p><ul class="chips">${e.artists.filter((x) => ctx.artists[x]).slice(0, 6).map((x) => `<li><a href="/artists/${esc(x)}/#notify">${esc(ctx.artists[x].name)}</a></li>`).join('')}</ul></section>` : ''}
${e.kind !== 'collection' && m.kind !== 'gallery' ? catalogBox(site, e, st) : ''}`;
  return layout({ site, wide: true, path: `/exhibitions/${e.id}/`, title: `${e.title}（${m.name}）`, description: `${e.title}。${m.name}にて${period(e)}。${e.summary}`, body: `
${pageHead(`EXHIBITION · <a href="/museums/${esc(m.id)}/">${esc(m.name)}</a>`, esc(e.title), '', `<p class="head-date"><span class="badge ${st}">${STATUS[st]}</span> ${period(e)}</p>`)}
${cols(main, side)}` });
}

export function searchPage({ site, genres, prefsByArea, museums, lineBasicId }) {
  const chip = (name, value, label) => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(value)}"><span>${esc(label)}</span><small data-count="${name}:${esc(value)}"></small></label>`;
  // Each kind of condition folds into one row; the row shows what is chosen.
  const facet = (key, label, body, hint = '') => `<details class="facet" data-facet="${key}"><summary><span class="facet-name">${label}</span><span class="facet-val" data-sel="${key}">指定なし</span></summary><div class="facet-panel">${hint ? `<p class="hint">${hint}</p>` : ''}${body}</div></details>`;
  return layout({ site, path: '/search/', title: '展覧会を探す', description: '全国の美術館・ギャラリーの展覧会を、地域・ジャンル・会期・作家名で絞り込めます。条件をLINEに登録すると、合う展覧会が発表されたときにお知らせします。', body: `
${pageHead('SEARCH', '展覧会を探す')}
<form id="filters" class="search" data-line="${esc(lineBasicId ?? '')}">
<div class="search-big"><input name="q" type="search" placeholder="作家名・展覧会名・会場名" aria-label="キーワード"><button type="submit">さがす</button></div>
<div class="facets">
${facet('area', '地域', prefsByArea.map(([k, label, prefs]) => `<div class="area-row">${chip('area', k, label)}<span class="prefs">${prefs.map((p) => chip('pref', p, p)).join('')}</span></div>`).join(''), '地方ごと、または都道府県ごとに選べます。いくつ選んでもOKです。')}
${facet('genre', 'ジャンル', `<div class="chip-row">${genres.map((g) => chip('genre', g, g)).join('')}</div>`, 'いくつ選んでもOKです。地域と組み合わせると、両方に当てはまる展覧会に絞り込みます。')}
${facet('when', '時期', `<div class="when"><select name="when" aria-label="時期">${WHEN.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
<span class="range"><input type="date" name="from" aria-label="この日から"> 〜 <input type="date" name="to" aria-label="この日まで"></span>
<label class="check"><input type="checkbox" name="special" value="1"> 企画展のみ（コレクション展を除く）</label></div>`)}
${facet('museum', '会場', `<div class="venue-kind">${VENUES.map(([k, v]) => `<label class="check"><input type="radio" name="venue" value="${k}"${k ? '' : ' checked'}> ${esc(v)}</label>`).join('')}</div>` + [['museum', '美術館'], ['gallery', 'ギャラリー']].map(([kind, kindLabel]) => prefsByArea.map(([k, label]) => { const ms = museums.filter((m) => m.area === k && (m.kind ?? 'museum') === kind); return ms.length ? `<p class="museum-group" data-kind="${kind}">${esc(label)}の${kindLabel}</p><div class="chip-row" data-kind="${kind}">${ms.map((m) => chip('museum', m.id, m.name)).join('')}</div>` : ''; }).join('')).join(''))}
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
<div class="alert-actions"><a id="alert-line" class="btn line" href="#" data-track="line-search">この条件をLINEで受け取る</a><button type="button" id="copy-link" class="btn alt">URLをコピー</button></div>
</div>
</section>
<noscript><p class="note">検索には JavaScript を有効にしてください。</p></noscript>
<script type="module" src="/assets/search.js"></script>` });
}

export function requestPage({ site }) {
  return layout({ site, path: '/request/', title: '掲載してほしい施設をリクエスト', description: 'ArtPingに載っていない美術館・ギャラリーを教えてください。', body: `
${pageHead('REQUEST', '掲載してほしい施設をリクエスト')}
<p>ArtPingに載っていない美術館・ギャラリーを教えてください。公式サイトに展覧会の一覧があり、企画展を定期的に開いている施設を順に追加します（貸しギャラリーは対象外です）。</p>
<form id="request" class="request box" method="post" action="/api/request">
<label>施設名<span class="req">必須</span><input name="name" required maxlength="80" placeholder="例：〇〇ギャラリー"></label>
<label>公式サイトのURL<input name="url" type="url" maxlength="300" placeholder="https://"></label>
<label>ひとこと（任意）<textarea name="note" maxlength="500" rows="3" placeholder="好きな作家がよく個展をしている、など"></textarea></label>
<label class="hp" aria-hidden="true">website<input name="website" tabindex="-1" autocomplete="off"></label>
<p><button type="submit" class="btn big">リクエストを送る</button></p>
<p class="result" role="status" hidden></p>
</form>
<p class="hint">いただいたリクエストはすべて確認しますが、追加をお約束するものではありません。</p>
<script>
const f = document.getElementById('request'), out = f.querySelector('.result');
f.addEventListener('submit', async (e) => {
  e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
  try {
    const r = await (await fetch(f.action, { method: 'POST', body: new FormData(f) })).json();
    out.textContent = r.ok ? 'ありがとうございます。リクエストを受け付けました。' : r.error; if (r.ok) f.reset();
  } catch { out.textContent = '送信できませんでした。時間をおいてもう一度お試しください。'; }
  out.hidden = false; b.disabled = false;
});
</script>` });
}

export function areaPage({ site, area, label, prefs, ctx, description }) {
  const total = prefs.reduce((n, [, shows]) => n + shows.length, 0);
  return layout({ site, path: `/areas/${area}/`, title: `${label}で開催中・開催予定の展覧会`, description, body: `
${pageHead('AREA', `${esc(label)}の展覧会`)}
<p class="lede">${esc(label)}の美術館・ギャラリーで開催中・開催予定の展覧会${total}件を、都道府県ごとに開幕日の順で並べています。条件を細かく指定したいときは <a href="/search/?area=${esc(area)}">探すページ</a> をお使いください。</p>
${prefs.map(([pref, shows]) => `<h2>${esc(pref)}（${shows.length}件）</h2>${list(shows, ctx)}`).join('')}` });
}

export function monthlyPage({ site, ym, ctx, opening, closing, ongoing, intro, prev, next }) {
  const label = `${+ym.slice(0, 4)}年${+ym.slice(5)}月`;
  const byArea = (xs) => AREAS.map(([k, name]) => [name, xs.filter((e) => ctx.museums[e.museumId].area === k)]).filter(([, ys]) => ys.length);
  const nav = `<p class="month-nav">${prev ? `<a href="/monthly/${prev}/">← ${+prev.slice(5)}月</a>` : ''}<a href="/monthly/">月別一覧</a>${next ? `<a href="/monthly/${next}/">${+next.slice(5)}月 →</a>` : ''}</p>`;
  return layout({ site, path: `/monthly/${ym}/`, title: `${label}の展覧会`, description: `${label}に始まる展覧会${opening.length}件と、${label}で終わる展覧会${closing.length}件を、地域ごとにまとめました。`, body: `
${pageHead('MONTHLY', `${label}の展覧会`)}
${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
<p class="lede">${label}に始まる展覧会は${opening.length}件、${label}で終わる展覧会は${closing.length}件です${ongoing ? `（ほかに会期中の展覧会が${ongoing}件あります）` : ''}。</p>
${nav}
<h2>${label}に始まる展覧会</h2>${opening.length ? byArea(opening).map(([a, xs]) => `<h3 class="year">${esc(a)}</h3>${rows(xs, ctx)}`).join('') : '<p class="empty">いまのところありません。</p>'}
<h2>${label}で終わる展覧会</h2>${closing.length ? byArea(closing).map(([a, xs]) => `<h3 class="year">${esc(a)}</h3>${rows(xs, ctx)}`).join('') : '<p class="empty">いまのところありません。</p>'}
${nav}` });
}

export function indexPage({ site, path, title, html }) {
  return layout({ site, path, title, body: `${pageHead('ArtPing', esc(title))}${html}` });
}

