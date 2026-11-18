// Artist books (画集・作品集) from the official Rakuten Books API, shown as cover cards on artist and exhibition pages.
// Only the API's own fields are used (cover image, title, price, link); no scraping.

const ENDPOINT = 'https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404';
const squash = (s) => String(s ?? '').normalize('NFKC').replace(/[\s・･,.、]/g, '').toLowerCase();

/** One page of Rakuten Books results for an author name (raw API items). */
export async function searchBooks({ name, appId, accessKey, affiliateId, fetchFn = fetch }) {
  const q = new URLSearchParams({ format: 'json', formatVersion: '2', applicationId: appId, accessKey, author: name, hits: '20', sort: 'standard', outOfStockFlag: '0' });
  if (affiliateId) q.set('affiliateId', affiliateId);
  const res = await fetchFn(`${ENDPOINT}?${q}`, { headers: { accessKey } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Rakuten ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.Items ?? []).map((x) => x.Item ?? x);
}

/**
 * Up to `max` books really by this artist, with a cover: the author field must contain the name
 * (so a common surname alone does not match), and the same title in several editions counts once.
 */
export function pickBooks(names, items, max = 4) {
  const keys = names.map(squash).filter((k) => k.length >= 2);
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const author = squash(x.author);
    if (!keys.some((k) => author.includes(k))) continue;
    const img = x.largeImageUrl || x.mediumImageUrl;
    if (!img || /noimage/i.test(img)) continue;
    const key = squash(String(x.title).normalize('NFKC').replace(/[(\[【〈].*?[)\]】〉]|新装版|普及版|改訂版|増補版/g, '')).slice(0, 12);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: x.title,
      author: x.author,
      price: x.itemPrice || null,
      image: img.replace(/\?_ex=\d+x\d+/, '?_ex=240x240'),
      url: x.affiliateUrl || x.itemUrl,
      affiliate: Boolean(x.affiliateUrl),
      salesDate: x.salesDate || '',
    });
    if (out.length >= max) break;
  }
  return out;
}
