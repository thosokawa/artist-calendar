// LINE Messaging API helpers shared by the webhook and the notifier (Cloudflare Pages Functions).
// Pure functions where possible, so they can be tested in Node.

export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const MAX_FOLLOWS = 200;

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** LINE signs each webhook body with the channel secret (HMAC-SHA256, base64). */
export async function validSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = b64(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Shared secret for the build workflow to call /api/notify, derived from the channel secret both sides already hold. */
export async function notifyKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(`${secret}:notify`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Text the website pre-fills when someone taps "LINEで通知を受け取る". */
export const followText = (name, slug) => `${name}の展覧会を通知 [${slug}]`;

const normalize = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s・･.=＝]/g, '');

/**
 * What did the person send?
 *   "<name>の展覧会を通知 [slug]"  -> follow that artist
 *   "一覧" / "登録一覧"             -> list follows
 *   anything else                  -> search artists by name
 */
export function parseText(text) {
  const t = String(text ?? '').trim();
  const m = /\[([a-z0-9-]+)\]\s*$/.exec(t);
  if (m && SLUG.test(m[1])) return { kind: 'follow', slug: m[1] };
  if (/^(登録)?一覧$|^リスト$/.test(t)) return { kind: 'list' };
  if (/^(使い方|ヘルプ|help)$/i.test(t)) return { kind: 'help' };
  return { kind: 'search', query: t };
}

/** artists: {slug: name}. Returns up to `limit` slugs whose name contains the query (exact matches first). */
export function searchArtists(artists, query, limit = 12) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const hits = Object.entries(artists).filter(([slug, name]) => normalize(name).includes(q) || slug.includes(q.replace(/\s+/g, '-')));
  hits.sort(([, a], [, b]) => (normalize(a) === q ? -1 : 0) - (normalize(b) === q ? -1 : 0) || a.length - b.length);
  return hits.slice(0, limit).map(([slug]) => slug);
}

const label = (s) => (s.length > 20 ? `${s.slice(0, 19)}…` : s);

export function quickReply(items) {
  return { items: items.slice(0, 13).map(({ text, data }) => ({ type: 'action', action: { type: 'postback', label: label(text), data, displayText: text } })) };
}

export const HELP = '好きな作家の名前を送ってください（例: 草間彌生）。登録した作家の新しい展覧会が決まると、ここでお知らせします。\n「一覧」と送ると登録中の作家を確認・解除できます。';

/**
 * Notification for one person: a carousel of new exhibitions, each with buttons to add it to their calendar.
 * ex: { id, title, museum, startDate, endDate, artists: [names], gcal }, siteUrl: https://...
 */
export function exhibitionCarousel(exhibitions, siteUrl) {
  const fmt = (d) => d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1/$2/$3');
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const columns = exhibitions.slice(0, 10).map((e) => ({
    title: cut(e.title, 40),
    text: cut(`${e.artists.join('、')}\n${e.museum}\n${fmt(e.startDate)}〜${fmt(e.endDate)}`, 60),
    actions: [
      { type: 'uri', label: 'Googleカレンダーに追加', uri: e.gcal },
      { type: 'uri', label: 'iPhoneのカレンダーに追加', uri: `${siteUrl}/exhibitions/${e.id}.ics` },
      { type: 'uri', label: '詳しく見る', uri: `${siteUrl}/exhibitions/${e.id}/` },
    ],
  }));
  const names = [...new Set(exhibitions.flatMap((e) => e.artists))].slice(0, 5).join('、');
  return [
    { type: 'text', text: `登録中の作家（${names}）の新しい展覧会が発表されました。` },
    { type: 'template', altText: `新しい展覧会: ${exhibitions[0].title}`.slice(0, 400), template: { type: 'carousel', columns } },
  ];
}

export async function lineApi(path, token, body) {
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LINE ${path}: HTTP ${res.status} ${await res.text()}`);
}
