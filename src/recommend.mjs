// "If you like this artist": artists shown together, then shared genres, then shared museums.
// Once people follow artists (LINE / calendar), co-follow counts can be added as another signal.

export function artistProfiles(exhibitions) {
  const p = {};
  for (const e of exhibitions) {
    for (const s of e.artists) {
      const a = (p[s] ??= { exhibitions: new Set(), genres: new Set(), museums: new Set() });
      a.exhibitions.add(e.id);
      e.genres.forEach((g) => a.genres.add(g));
      a.museums.add(e.museumId);
    }
  }
  return p;
}

export function recommend(slug, profiles, { limit = 6 } = {}) {
  const me = profiles[slug];
  if (!me) return [];
  const scored = [];
  for (const [other, p] of Object.entries(profiles)) {
    if (other === slug) continue;
    let score = 0;
    for (const id of p.exhibitions) if (me.exhibitions.has(id)) score += 3;
    for (const g of p.genres) if (me.genres.has(g)) score += 1;
    for (const m of p.museums) if (me.museums.has(m)) score += 0.5;
    if (score >= 1.5) scored.push({ slug: other, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug)).slice(0, limit);
}
