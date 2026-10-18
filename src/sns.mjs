// Official social accounts of venues and artists: recognise account links, and pick them out of a page.
// Only account (profile) URLs are kept; share buttons, single posts and hashtags are not accounts.

export const SNS_KINDS = ['instagram', 'x', 'facebook', 'youtube', 'tiktok', 'threads'];
export const SNS_LABEL = { website: '公式サイト', instagram: 'Instagram', x: 'X', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', threads: 'Threads' };

const NOT_ACCOUNTS = {
  instagram: /^(p|reel|reels|explore|stories|accounts|tv|share|direct|about|developer|legal|web)$/i,
  x: /^(intent|share|home|hashtag|search|i|login|signup|settings|explore|messages|notifications|privacy|tos)$/i,
  facebook: /^(sharer|share|sharer\.php|dialog|plugins|tr|login|events|groups|watch|help|policies|privacy|hashtag|photo\.php|story\.php|permalink\.php|l\.php)$/i,
};

/** One account link -> { kind, url } in a canonical form, or null when it is not a profile. */
export function parseSnsUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim().replace(/^\/\//, 'https://')); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|ja-jp|ja-JP|jp)\./i, '');
  const parts = u.pathname.split('/').filter(Boolean);
  const first = decodeURIComponent(parts[0] ?? '');
  if (host === 'instagram.com') {
    if (!/^[A-Za-z0-9._]{1,30}$/.test(first) || NOT_ACCOUNTS.instagram.test(first)) return null;
    return { kind: 'instagram', url: `https://www.instagram.com/${first.toLowerCase()}/` };
  }
  if (host === 'x.com' || host === 'twitter.com') {
    if (!/^[A-Za-z0-9_]{1,15}$/.test(first) || NOT_ACCOUNTS.x.test(first)) return null;
    return { kind: 'x', url: `https://x.com/${first}` };
  }
  if (host === 'facebook.com' || host === 'fb.com') {
    if (first === 'profile.php') { const id = u.searchParams.get('id'); return id && /^\d+$/.test(id) ? { kind: 'facebook', url: `https://www.facebook.com/profile.php?id=${id}` } : null; }
    // Old-style page URLs end in the page's numeric id; /pages/category/... is a directory, not a page.
    if (first === 'pages') { const id = parts.find((x) => /^\d{6,}$/.test(x)); return id ? { kind: 'facebook', url: `https://www.facebook.com/${id}` } : null; }
    if (!/^[\p{L}\p{N}.\-_]{2,80}$/u.test(first) || NOT_ACCOUNTS.facebook.test(first)) return null;
    return { kind: 'facebook', url: `https://www.facebook.com/${encodeURIComponent(first)}` };
  }
  if (host === 'youtube.com') {
    if (/^@[\p{L}\p{N}._-]{2,100}$/u.test(first)) return { kind: 'youtube', url: `https://www.youtube.com/${encodeURIComponent(first).replace('%40', '@')}` };
    if (['channel', 'c', 'user'].includes(first) && parts[1]) return { kind: 'youtube', url: `https://www.youtube.com/${first}/${encodeURIComponent(decodeURIComponent(parts[1]))}` };
    return null;
  }
  if (host === 'tiktok.com') return /^@[A-Za-z0-9._]{2,24}$/.test(first) ? { kind: 'tiktok', url: `https://www.tiktok.com/${first}` } : null;
  if (host === 'threads.net' || host === 'threads.com') return /^@[A-Za-z0-9._]{1,30}$/.test(first) ? { kind: 'threads', url: `https://www.threads.com/${first.toLowerCase()}` } : null;
  return null;
}

/** The account id part of a canonical URL, for checking that a page really links to it. */
export function snsHandle(url) {
  const p = parseSnsUrl(url);
  if (!p) return null;
  const u = new URL(p.url);
  return (u.searchParams.get('id') ?? u.pathname.split('/').filter(Boolean).pop()).replace(/^@/, '').toLowerCase();
}

/** Every account link on an HTML page, grouped by kind and ordered by how often each appears. */
export function snsLinksInHtml(html) {
  const counts = new Map();
  for (const m of String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const p = parseSnsUrl(m[1].replace(/&amp;/g, '&'));
    if (p) counts.set(p.url, { ...p, n: (counts.get(p.url)?.n ?? 0) + 1 });
  }
  const out = {};
  for (const kind of SNS_KINDS) out[kind] = [...counts.values()].filter((x) => x.kind === kind).sort((a, b) => b.n - a.n).map((x) => x.url);
  return out;
}

/** Does this page link to that account? (Used to accept an account only when an official page names it.) */
export function htmlLinksTo(html, url) {
  const h = snsHandle(url);
  const kind = parseSnsUrl(url)?.kind;
  return Boolean(h) && (snsLinksInHtml(html)[kind] ?? []).some((u) => snsHandle(u) === h);
}
