// Official website and social accounts of an artist.
// Claude searches the web and proposes accounts with the official pages that link to them;
// an account is kept only if one of those pages, fetched by us, names the artist and links to it.
import Anthropic from '@anthropic-ai/sdk';
import { htmlToText } from './text.mjs';
import { fetchHtml } from './fetch-html.mjs';
import { parseSnsUrl, htmlLinksTo, snsLinksInHtml } from './sns.mjs';

const MODEL = process.env.COLLECT_MODEL ?? 'claude-opus-5-5';

const SYSTEM = `美術作家の「本人の公式」ウェブサイトとSNSアカウントを調べます。
- 本人（または遺族・財団・事務所）が運営する公式のものだけを答えます。ファンアカウント、まとめ、同姓同名の別人、所属ギャラリーや美術館そのもののアカウントは含めません。
- 根拠として、そのアカウントへのリンクが実際に載っている公式ページ（本人サイト、所属ギャラリーの作家ページ、美術館の展覧会ページなど）のURLを sources に入れてください。InstagramやXそのもののページは根拠になりません。
- 見つからない、または確信が持てないときは空にします。推測でURLを作らないでください。
- 物故作家で公式の運営者がいない場合は、検索せずに空で答えて構いません。
- 最後に、次の形のJSONだけを書きます（説明文は不要）:
{"website": "https://..." または null, "accounts": ["https://www.instagram.com/...", "https://x.com/..."], "sources": ["https://..."]}`;

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s・･.,、。'’\-‐]/g, '');

function namesOf(a) {
  const out = [a.name, a.nameRomaji, ...(a.aliases ?? [])].filter(Boolean).map(norm);
  // Romaji is sometimes written family name first on Japanese pages.
  const r = String(a.nameRomaji ?? '').trim().split(/\s+/);
  if (r.length === 2) out.push(norm(`${r[1]} ${r[0]}`));
  return out.filter((n) => n.length >= 2);
}

function lastJson(text) {
  const t = String(text);
  const end = t.lastIndexOf('}');
  for (let i = t.lastIndexOf('{', end); i >= 0; i = t.lastIndexOf('{', i - 1)) {
    try { return JSON.parse(t.slice(i, end + 1)); } catch { /* try an earlier brace */ }
  }
  return null;
}

async function ask(a, client, log) {
  const messages = [{ role: 'user', content: `作家: ${a.name}${a.nameRomaji && a.nameRomaji !== a.name ? `（${a.nameRomaji}）` : ''}` }];
  for (let i = 0; i < 4; i += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
      messages,
    });
    if (response.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: response.content }); continue; }
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = lastJson(text);
    if (!parsed) log(`  no JSON in answer (${response.stop_reason}): ${text.slice(-300).replace(/\s+/g, ' ')}`);
    return parsed;
  }
  return null;
}

/** -> { website?, sns: {kind: url} } with only what an official page confirms. */
export async function findArtistSns(a, { client = new Anthropic(), log = () => {}, venueHosts = new Set() } = {}) {
  const proposal = await ask(a, client, log);
  if (!proposal) return { sns: {} };
  const names = namesOf(a);
  const accounts = (proposal.accounts ?? []).map(parseSnsUrl).filter(Boolean);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  // A venue's page about the artist is evidence, but not the artist's own website.
  const website = /^https?:\/\//.test(proposal.website ?? '') && !parseSnsUrl(proposal.website) && !venueHosts.has(host(proposal.website)) ? proposal.website : null;
  const pages = [...new Set([website, ...(proposal.sources ?? [])].filter((u) => /^https?:\/\//.test(u ?? '') && !parseSnsUrl(u)))].slice(0, 4);
  log(`  proposed: ${website ?? '-'} ${accounts.map((x) => x.url).join(' ')} via ${pages.join(' ')}`);

  const result = { sns: {} };
  const siteWide = new Map();
  for (const url of pages) {
    const html = await fetchHtml(url, { enough: (h) => h.length > 2000 });
    const text = norm(htmlToText(html));
    if (!names.some((n) => text.includes(n))) { log(`  ✗ ${url}: artist name not on the page`); continue; }
    if (url === website) result.website = website;
    // A gallery's own accounts sit in every page's header or footer; links that also appear on the
    // site's top page belong to the site, not to the artist (the artist's own site is exempt).
    let shared = new Set();
    if (url !== website) {
      const origin = new URL(url).origin;
      if (!siteWide.has(origin)) siteWide.set(origin, new Set(Object.values(snsLinksInHtml(await fetchHtml(origin + '/', { browser: false }))).flat()));
      shared = siteWide.get(origin);
    }
    for (const acc of accounts) {
      if (result.sns[acc.kind] || shared.has(acc.url)) continue;
      if (htmlLinksTo(html, acc.url)) result.sns[acc.kind] = acc.url;
    }
  }
  return result;
}
