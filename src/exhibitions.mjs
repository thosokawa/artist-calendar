// Exhibition records: stable ids, merging fresh readings of a museum page into what we already have.
import { sha256 } from './text.mjs';
import { resolveArtist } from './artists.mjs';

export const GENRES = ['現代美術', '日本画', '洋画', '版画', '彫刻', '写真', '工芸', 'デザイン', '建築', '書', '浮世絵', '古美術', 'マンガ・アニメ', 'メディアアート'];

/** Title without provisional marks or brackets, for matching the same show across updates and venues. */
export function normalizeTitle(title) {
  return String(title)
    .normalize('NFKC')
    .replace(/[（(]\s*仮(称|題)?\s*[)）]/g, '')
    .replace(/[\s「」『』【】〈〉《》"'“”‘’・:：\-‐–—―~〜]/g, '')
    .toLowerCase();
}

/** Is this title really on the page? Ignores spacing, brackets and provisional marks, to catch invented entries. */
export function titleOnPage(title, pageText) {
  const t = normalizeTitle(title);
  return t.length > 0 && normalizeTitle(pageText.replace(/\n/g, '')).includes(t);
}

export function exhibitionId(museumId, x) {
  return `${museumId}-${x.startDate.replace(/-/g, '')}-${sha256(normalizeTitle(x.title)).slice(0, 6)}`;
}

const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && !Number.isNaN(Date.parse(d));

/** Same show? Same museum and start date, and the same end date, the same title or at least one shared artist. */
function sameShow(a, b) {
  if (a.startDate !== b.startDate) return false;
  if (a.endDate === b.endDate || normalizeTitle(a.title) === normalizeTitle(b.title)) return true;
  return a.artists.some((s) => b.artists.includes(s));
}

/**
 * Merge a fresh reading (raw extractions) into the museum's stored exhibitions.
 * Returns { exhibitions, added } where added are the newly announced ones (for "new" lists and notifications).
 * Exhibitions no longer on the page are kept: past shows stay on artist pages.
 */
export function mergeExhibitions({ museumId, stored, fresh, registry, today }) {
  const out = stored.map((e) => ({ ...e }));
  const added = [];
  for (const raw of fresh) {
    if (!raw.title || !validDate(raw.startDate) || !validDate(raw.endDate) || raw.endDate < raw.startDate) continue;
    const x = {
      title: raw.title.trim(),
      startDate: raw.startDate,
      endDate: raw.endDate,
      kind: raw.kind === 'collection' ? 'collection' : 'special',
      artists: [...new Set((raw.artists ?? []).filter((a) => a?.name).map((a) => resolveArtist(registry, a)))],
      genres: (raw.genres ?? []).filter((g) => GENRES.includes(g)),
      detailUrl: raw.detailUrl || null,
      summary: raw.summary || '',
    };
    const prev = out.find((e) => sameShow(e, x));
    if (prev) {
      // Keep the id and first-seen date; take the newer wording and dates.
      Object.assign(prev, x, { artists: [...new Set([...prev.artists, ...x.artists])], lastSeenAt: today });
      continue;
    }
    const rec = { id: exhibitionId(museumId, x), museumId, ...x, firstSeenAt: today, lastSeenAt: today };
    out.push(rec);
    added.push(rec);
  }
  // Earlier readings may have stored one show twice (e.g. under two spellings of the artist); fold them together.
  const kept = [];
  for (const e of [...out].sort((a, b) => (a.firstSeenAt ?? '').localeCompare(b.firstSeenAt ?? ''))) {
    const twin = kept.find((k) => sameShow(k, e));
    if (twin) { twin.artists = [...new Set([...twin.artists, ...e.artists])]; twin.detailUrl ??= e.detailUrl; continue; }
    kept.push(e);
  }
  kept.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { exhibitions: kept, added: added.filter((a) => kept.includes(a)) };
}

export function statusOn(e, today) {
  if (e.endDate < today) return 'past';
  if (e.startDate > today) return 'upcoming';
  return 'current';
}

/** Dice similarity of character bigrams of normalized titles (0..1); used to spot touring shows. */
export function titleSimilarity(a, b) {
  const grams = (s) => { const t = normalizeTitle(s); const m = new Map(); for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1); return m; };
  const A = grams(a), B = grams(b);
  let inter = 0, total = 0;
  for (const [g, n] of A) { inter += Math.min(n, B.get(g) ?? 0); total += n; }
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

/** Touring show: another museum, and the same title or a similar title with an artist in common. */
export function isSameTour(a, b) {
  if (a.id === b.id || a.museumId === b.museumId) return false;
  if (normalizeTitle(a.title) === normalizeTitle(b.title)) return true;
  return a.artists.some((s) => b.artists.includes(s)) && titleSimilarity(a.title, b.title) >= 0.6;
}
