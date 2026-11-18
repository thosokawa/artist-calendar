// Counts presses of the LINE buttons (sent with navigator.sendBeacon). Stores only day, button and page path.
const KINDS = new Set(['line-header', 'line-artist', 'line-artist-card', 'line-about', 'line-search']);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });
  const body = await request.json().catch(() => null);
  const kind = String(body?.k ?? '');
  const page = String(body?.p ?? '').slice(0, 200);
  if (!KINDS.has(kind) || !/^\/[\w\-./%]*$/.test(page)) return new Response(null, { status: 400 });
  // Japan date, so a day's count matches the site's other dates.
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  await env.DB.prepare('INSERT INTO clicks (day, kind, page, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, kind, page) DO UPDATE SET n = n + 1').bind(day, kind, page).run();
  return new Response(null, { status: 204 });
}
