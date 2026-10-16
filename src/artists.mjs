// Artist identity: one record per person, however the museum wrote the name.
import { sha256 } from './text.mjs';

// Old/variant kanji that museums use interchangeably in artist names.
const VARIANTS = { 彌: '弥', 澤: '沢', 邊: '辺', 邉: '辺', 齋: '斎', 齊: '斉', 髙: '高', 﨑: '崎', 嶋: '島', 廣: '広', 國: '国', 藝: '芸', 濱: '浜', 櫻: '桜', 龍: '竜', 條: '条', 惠: '恵', 眞: '真', 實: '実', 圓: '円', 壽: '寿', 德: '徳', 豐: '豊' };

/** Comparable form of a Japanese name: width-folded, spaces and dots removed, variant kanji unified. */
export function normalizeName(name) {
  return String(name)
    .normalize('NFKC')
    .replace(/[\s・･.=＝]/g, '')
    .replace(/[^\x00-\x7F]/g, (c) => VARIANTS[c] ?? c)
    .toLowerCase();
}

/** URL slug from a Latin name: "Yayoi Kusama" -> "yayoi-kusama". Falls back to a hash of the Japanese name. */
export function artistSlug({ name, nameRomaji }) {
  const latin = String(nameRomaji ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return latin.length >= 3 ? latin : `a-${sha256(normalizeName(name)).slice(0, 10)}`;
}

/**
 * Find or create the artist in `registry` ({slug: {name, nameRomaji, aliases}}), returning its slug.
 * Matches first on the normalized Japanese name (so 草間彌生 and 草間弥生 are one person), then on the slug.
 */
export function resolveArtist(registry, { name, nameRomaji }) {
  const key = normalizeName(name);
  for (const [slug, a] of Object.entries(registry)) {
    if ([a.name, ...(a.aliases ?? [])].some((n) => normalizeName(n) === key)) return slug;
  }
  let slug = artistSlug({ name, nameRomaji });
  const existing = registry[slug];
  if (existing) {
    // Same Latin name, different Japanese spelling: record it as an alias of the same person.
    existing.aliases = [...new Set([...(existing.aliases ?? []), name])];
    return slug;
  }
  registry[slug] = { name, nameRomaji: nameRomaji || null, aliases: [] };
  return slug;
}
