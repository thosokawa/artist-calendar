// Exhibition search conditions, shared by the search page (browser), the build, and the LINE functions.
// A condition lives in a URL query (?area=kanto&genre=現代美術,写真&q=草間), so a search can be shared,
// bookmarked, or sent to the LINE bot to be told about new exhibitions that match it.
// Self-contained on purpose: the browser loads this file as it is.

export const GENRES = ['現代美術', '日本画', '洋画', '版画', '彫刻', '写真', '工芸', 'デザイン', '建築', '書', '浮世絵', '古美術', 'マンガ・アニメ', 'メディアアート'];
export const AREAS = [['hokkaido-tohoku', '北海道・東北'], ['kanto', '関東'], ['chubu', '中部'], ['kansai', '関西'], ['chugoku-shikoku', '中国・四国'], ['kyushu-okinawa', '九州・沖縄']];
export const WHEN = [['', '開催中と開催予定'], ['current', '開催中'], ['upcoming', '開催予定'], ['ending', 'まもなく終了（2週間以内）'], ['weekend', '今週末に見られる'], ['month', '今月見られる'], ['range', '日付を指定']];
export const SORTS = [['start', '開幕日が近い順'], ['end', '終了日が近い順'], ['new', '発表が新しい順']];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const list = (v) => [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
// Hiragana is folded into katakana so よしだ and ヨシダ match the same reading.
export const normText = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s・･]/g, '').replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** Read a condition from a query string or URLSearchParams, dropping anything unknown. */
export function parseFilter(input) {
  const p = typeof input === 'string' ? new URLSearchParams(input.replace(/^\?/, '')) : input;
  const areaKeys = AREAS.map(([k]) => k);
  const f = {
    q: String(p.get('q') ?? '').replace(/[&=\[\]%]/g, ' ').trim().slice(0, 40),
    areas: list(p.get('area')).filter((a) => areaKeys.includes(a)),
    prefs: list(p.get('pref')).filter((s) => /^.{2,4}[都道府県]$/.test(s)).slice(0, 47),
    genres: list(p.get('genre')).filter((g) => GENRES.includes(g)),
    museums: list(p.get('museum')).filter((s) => /^[a-z0-9-]{1,40}$/.test(s)).slice(0, 50),
    special: p.get('special') === '1',
    when: WHEN.some(([k]) => k === p.get('when')) ? p.get('when') : '',
    from: DATE.test(p.get('from') ?? '') ? p.get('from') : '',
    to: DATE.test(p.get('to') ?? '') ? p.get('to') : '',
    sort: SORTS.some(([k]) => k === p.get('sort')) ? p.get('sort') : 'start',
  };
  if (f.when !== 'range') f.from = f.to = '';
  return f;
}

/** Canonical query string (same condition -> same string), without defaults. */
export function filterQuery(f, { alertOnly = false } = {}) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.areas.length) p.set('area', [...f.areas].sort().join(','));
  if (f.prefs.length) p.set('pref', [...f.prefs].sort().join(','));
  if (f.genres.length) p.set('genre', [...f.genres].sort().join(','));
  if (f.museums.length) p.set('museum', [...f.museums].sort().join(','));
  if (f.special) p.set('special', '1');
  if (!alertOnly) {
    if (f.when) p.set('when', f.when);
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    if (f.sort !== 'start') p.set('sort', f.sort);
  }
  return p.toString();
}

/** The alert part of a condition as readable text, for the message sent to the LINE bot ("area=kanto&genre=写真"). */
export function filterText(f) {
  return [...new URLSearchParams(filterQuery(f, { alertOnly: true }))].map(([k, v]) => `${k}=${v}`).join('&');
}

/** Can this condition be used for new-exhibition alerts? It needs at least one thing to narrow by. */
export const alertable = (f) => Boolean(f.q || f.areas.length || f.prefs.length || f.genres.length || f.museums.length);

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** The days a "when" choice covers, as [from, to] (inclusive); null for no limit on that side. */
export function whenRange(f, today) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  switch (f.when) {
    case 'current': return [today, today];
    case 'upcoming': return [addDays(today, 1), null];
    case 'ending': return [today, today];
    case 'weekend': { const sat = addDays(today, dow === 0 ? -1 : 6 - dow); return [sat < today ? today : sat, addDays(sat, 1)]; }
    case 'month': return [today, `${today.slice(0, 8)}31`];
    case 'range': return [f.from || today, f.to || null];
    default: return [today, null];
  }
}

/**
 * Does an exhibition match? r is the compact record of /data/search.json:
 *   { id, t: title, s: start, e: end, k: kind, g: genres, m: museum name, mid: museum id, p: prefecture, r: area, a: [[slug, name, ...aliases]], f: first seen }
 * For alerts (forAlert) only what the show is matters, not when it is on.
 */
export function matchExhibition(r, f, today, { forAlert = false } = {}) {
  if (f.areas.length || f.prefs.length) {
    if (!f.areas.includes(r.r) && !f.prefs.includes(r.p)) return false;
  }
  if (f.genres.length && !f.genres.some((g) => r.g.includes(g))) return false;
  if (f.museums.length && !f.museums.includes(r.mid)) return false;
  if (f.special && r.k !== 'special') return false;
  if (f.q) {
    const words = f.q.split(/[\s　]+/).map(normText).filter(Boolean);
    const hay = normText([r.t, r.m, r.p, ...r.a.flat()].join(' '));
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (forAlert) return true;
  if (r.e < today) return false;
  if (f.when === 'upcoming' && r.s <= today) return false;
  if (f.when === 'ending' && (r.s > today || r.e > addDays(today, 14))) return false;
  const [from, to] = whenRange(f, today);
  // On at some point between from and to.
  if (to && r.s > to) return false;
  if (from && r.e < from) return false;
  return true;
}

export function sortResults(hits, f) {
  const by = {
    start: (a, b) => a.s.localeCompare(b.s) || a.e.localeCompare(b.e),
    end: (a, b) => a.e.localeCompare(b.e) || a.s.localeCompare(b.s),
    new: (a, b) => (b.f ?? '').localeCompare(a.f ?? '') || a.s.localeCompare(b.s),
  }[f.sort] ?? ((a, b) => a.s.localeCompare(b.s));
  return [...hits].sort(by);
}

/** Short Japanese description, e.g. "関東・東京都 ／ 現代美術・写真 ／ 「草間」 ／ 企画展のみ". */
export function describeFilter(f, { museumNames = {}, alertOnly = false } = {}) {
  const parts = [];
  const place = [...f.areas.map((a) => AREAS.find(([k]) => k === a)?.[1] ?? a), ...f.prefs, ...f.museums.map((m) => museumNames[m] ?? m)];
  if (place.length) parts.push(place.join('・'));
  if (f.genres.length) parts.push(f.genres.join('・'));
  if (f.q) parts.push(`「${f.q}」`);
  if (f.special) parts.push('企画展のみ');
  if (!alertOnly && f.when && f.when !== 'range') parts.push(WHEN.find(([k]) => k === f.when)[1]);
  if (!alertOnly && f.when === 'range') parts.push(`${f.from || '今日'}〜${f.to || ''}`);
  return parts.join(' ／ ') || 'すべての展覧会';
}
