// Called by the build workflow after each deploy: tell followers about newly announced exhibitions.
// Reads /data/recent.json (announcements of the last 14 days); the notified table keeps it to once per person per exhibition.
// Only people who followed by the announcement day are told (someone who follows later sees it on the artist page).
// One push per person per run, so each person costs one message from the monthly LINE quota.
import { notifyKey, exhibitionCarousel, lineApi } from '../../src/line.mjs';

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.LINE_CHANNEL_SECRET || auth !== `Bearer ${await notifyKey(env.LINE_CHANNEL_SECRET)}`) return new Response('forbidden', { status: 403 });
  if (!env.DB) return new Response('not ready', { status: 503 });
  const siteUrl = new URL(request.url).origin;
  const recent = await (await env.ASSETS.fetch(new URL('/data/recent.json', request.url))).json();

  const perUser = new Map();
  for (const e of recent) {
    if (!e.slugs.length) continue;
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT f.user_id FROM follows f JOIN users u ON u.id = f.user_id AND u.active = 1
       WHERE f.artist IN (${e.slugs.map(() => '?').join(',')})
       AND f.created_at <= ?
       AND NOT EXISTS (SELECT 1 FROM notified n WHERE n.user_id = f.user_id AND n.exhibition_id = ?)`,
    ).bind(...e.slugs, `${e.announcedAt} 23:59:59`, e.id).all();
    for (const { user_id } of results) (perUser.get(user_id) ?? perUser.set(user_id, []).get(user_id)).push(e);
  }

  let sent = 0;
  const errors = [];
  for (const [userId, list] of perUser) {
    try {
      await lineApi('push', env.LINE_CHANNEL_ACCESS_TOKEN, { to: userId, messages: exhibitionCarousel(list, siteUrl) });
      await env.DB.batch(list.slice(0, 10).map((e) => env.DB.prepare('INSERT OR IGNORE INTO notified (user_id, exhibition_id) VALUES (?, ?)').bind(userId, e.id)));
      sent += 1;
    } catch (e) {
      errors.push(e.message);
    }
  }
  return new Response(JSON.stringify({ people: perUser.size, sent, errors: errors.slice(0, 5) }), { headers: { 'content-type': 'application/json' } });
}
