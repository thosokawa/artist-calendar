// Extra facts for venue and artist pages, read from official sites:
// a venue's address / access / closing days, a gallery's artist list, an artist's profile,
// and a short note for each month's round-up.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { recordUsage } from './usage.mjs';
import { quoteAppears } from './text.mjs';
import { dropSourceTalk } from './describe.mjs';

const MODEL = process.env.ENRICH_MODEL ?? 'claude-haiku-5-5';

async function parse(system, content, schema, client) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(schema) },
  });
  recordUsage(MODEL, response.usage);
  return response.parsed_output;
}

const VenueInfo = z.object({
  address: z.string().describe('the postal address exactly as written on the page (with 〒 code if present); empty if absent'),
  access: z.string().describe('how to get there: nearest station(s) and walking time, one short line in Japanese; empty if absent'),
  closed: z.string().describe('regular closing days only, e.g. 「月曜日（祝日の場合は翌日）、年末年始」; empty if absent'),
});

/** Address, access and closing days from a venue's own pages. Values not found on the page come back empty. */
export async function readVenueInfo({ venue, pageText, client = new Anthropic() }) {
  const out = await parse(`美術館・ギャラリーの公式サイトの文章から、来館者向けの基本情報を抜き出します。
- address: この施設（${venue.name}）の所在地。ページに書かれたとおりに写します。別の施設・運営会社・本社の住所は使いません。
- access: 最寄り駅と徒歩何分か、を短く1行で。複数路線があれば主なもの2〜3つまで。
- closed: 定休日・休館日の決まり（曜日、祝日の扱い、年末年始など）だけ。開館時間・料金・臨時休館の日付は書きません。
- 値はすべて日本語で書きます（英語のページなら日本語に直します。住所は書かれたとおり）。
- ページに書かれていないものは空文字にします。推測で補いません。`, `施設: ${venue.name}（${venue.prefecture}${venue.city ?? ''}）\n\n<page>\n${pageText.slice(0, 40000)}\n</page>`, VenueInfo, client);
  const info = { address: out?.address?.trim() ?? '', access: out?.access?.trim() ?? '', closed: out?.closed?.trim() ?? '' };
  // An address that is not on the page, or not in the venue's prefecture, is a guess or someone else's address.
  const pref = venue.prefecture.replace(/[都府県]$/, '');
  const place = [pref, venue.city].filter(Boolean);
  if (!quoteAppears(info.address, pageText) || !place.some((p) => info.address.includes(p))) info.address = '';
  if (/円|時\s*[〜~～-]|\d{1,2}:\d{2}/.test(info.closed)) info.closed = '';
  return info;
}

const Text = z.object({ text: z.string().describe('Japanese prose in your own words; empty string if the page does not say enough') });

/** A few sentences on who the artist is, from their own site or their gallery's page on them. */
export async function writeArtistProfile({ artist, pageText, client = new Anthropic() }) {
  const out = await parse(`作家の公式サイト、または作家を扱うギャラリーのその作家のページを読み、どんな作家かを紹介する文を3〜4文（120〜220字）で書きます。
- 作家本人について書きます。財団・団体・ギャラリー・サイトそのものの説明（設立、助成、所蔵数、運営など）は書きません。
- 生まれ年・出身地・学歴など経歴の要点、主な素材や技法、作品のテーマや特徴、主な受賞や収蔵先など、ページに書かれた事実を使います。
- ページの文章を写さず、自分の言葉で書きます。推測や一般論で補いません。
- 宣伝文句は使わず、です・ます調の落ち着いた文にします。情報源（「ページには」など）には触れません。
- 作家本人についての事実が2つ以上書かれていなければ text を空にします（作家名と分野しかわからない場合など）。`, `作家: ${artist.name}${artist.nameRomaji ? `（${artist.nameRomaji}）` : ''}\n\n<page>\n${pageText.slice(0, 30000)}\n</page>`, Text, client);
  return dropSourceTalk(out?.text ?? '');
}

/** One short paragraph introducing a month's round-up, from the list of shows only. */
export async function writeMonthIntro({ label, opening, closing, client = new Anthropic() }) {
  const line = (e) => `- ${e.title}（${e.venue}、${e.pref}、${e.startDate}〜${e.endDate}）`;
  const out = await parse(`美術展の情報サイトの「${label}の展覧会」まとめページの冒頭に置く紹介文を、2〜3文（100〜180字）で書きます。
- 下の一覧だけをもとに、その月の傾向（多い分野や時代、地域、注目の大型展など）を具体的な展覧会名を1〜3件挙げて紹介します。
- 一覧にないことは書きません。宣伝文句は使わず、です・ます調で。`, `${label}に始まる展覧会:\n${opening.map(line).join('\n') || '（なし）'}\n\n${label}で終わる展覧会:\n${closing.map(line).join('\n') || '（なし）'}`, Text, client);
  return out?.text?.trim() ?? '';
}

// Words used for a venue's access page and a gallery's artist list, in link text or URL.
export const ACCESS_LINK = /アクセス|交通案内|利用案内|ご利用案内|施設案内|来館|access|visit|information|about|概要/i;
export const ARTISTS_LINK = /^(?:artists?|作家|アーティスト|取扱作家|取り扱い作家|所属作家)$/i;
const NAV = /artists?\/?$/i;

/** Links on a page as [absolute url, text], same site only. */
export function links(html, base) {
  const host = new URL(base).hostname.replace(/^www\./, '');
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, '&'), base);
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== host || /\.(pdf|jpe?g|png|gif)$/i.test(u.pathname)) continue;
      out.push([u.href, m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()]);
    } catch { /* not a usable link */ }
  }
  return out;
}

export const accessLinks = (html, base) => [...new Set(links(html, base).filter(([u, t]) => ACCESS_LINK.test(t) || /access|visit|guide|info/i.test(new URL(u).pathname)).map(([u]) => u))];
export const artistsLink = (html, base) => links(html, base).find(([u, t]) => ARTISTS_LINK.test(t) || (NAV.test(new URL(u).pathname) && t.length < 20))?.[0] ?? null;

// Names as they may appear on a page: the main name (each side of "日本語/Latin"), aliases and the romaji name.
const squash = (s) => String(s).normalize('NFKC').replace(/[\s・･]/g, '').toLowerCase();
export function nameForms(a) {
  const forms = [...String(a.name).split('/'), ...(a.aliases ?? []), a.nameRomaji ?? ''].map(squash);
  // Short names (2 letters, or under 6 Latin letters) match too much by accident.
  return [...new Set(forms)].filter((f) => (/^[\x00-\x7f]+$/.test(f) ? f.length >= 6 : f.length >= 3));
}

/** Slugs of artists named on a gallery's artist-list page. */
export function artistsOnPage(pageText, artists) {
  const page = squash(pageText);
  return Object.entries(artists).filter(([, a]) => nameForms(a).some((f) => page.includes(f))).map(([s]) => s);
}

/** On a gallery's artist list, the link to one artist's own page (its text names the artist). */
export function artistPageLink(html, base, a) {
  const forms = nameForms(a);
  return links(html, base).find(([, t]) => forms.some((f) => squash(t).includes(f)))?.[0] ?? null;
}
