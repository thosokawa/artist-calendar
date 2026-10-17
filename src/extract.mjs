// Ask Claude to read a museum's official exhibition list and return its exhibitions as data.
// Facts only (title, dates, artists); the summary is written fresh so the museum's text is never copied.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { GENRES } from './exhibitions.mjs';

const MODEL = process.env.COLLECT_MODEL ?? 'claude-opus-5-5';

const Extraction = z.object({
  exhibitions: z.array(z.object({
    title: z.string().describe('Exhibition title exactly as written on the page'),
    startDate: z.string().describe('YYYY-MM-DD'),
    endDate: z.string().describe('YYYY-MM-DD; infer the year from the start date if omitted'),
    kind: z.enum(['special', 'collection']),
    artists: z.array(z.object({
      name: z.string().describe('Artist name as written on the page'),
      nameRomaji: z.string().describe('Usual Latin-script name, given name first, e.g. "Yayoi Kusama"'),
    })).describe('Featured artists named on the page; empty if none are named'),
    genres: z.array(z.enum(GENRES)),
    detailUrl: z.string().nullable().describe('Absolute URL of the official detail page, or null'),
    summary: z.string().describe('One original sentence in Japanese, 40-70 characters, in your own words'),
  })),
});

const SYSTEM = `あなたは美術館の公式サイトの「展覧会一覧」ページを読み、展覧会情報をデータにします。
- 美術館自身の企画展と、名前のついたコレクション展だけを含めます。貸しギャラリー・市民ギャラリー・公募展・団体展・ワークショップ・イベント・上映会は含めません。
- 会期が日付まで発表されていない展覧会（「2027年春」など）は含めません。
- 博物館を併設する館では、歴史・考古・民俗・自然史の展示は含めず、美術作品を見せる展覧会だけを含めます。
- この美術館の建物以外で開かれる展覧会（移動美術館・出張展示・他館での巡回など）と、常設の設置作品・長期展示は含めません。
- 作家名はページに書かれている表記のまま。グループ展は名前が出ている作家を最大10名まで。
- summary はページの文章を写さず、自分の言葉で1文（40〜70字）。
- ページに書かれていないことは推測しないでください。`;

export async function extractExhibitions({ museum, pageText, today, client = new Anthropic() }) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `美術館: ${museum.name}\nページ: ${museum.exhibitionsUrl}\n今日: ${today}（今日より前に終わった展覧会は除外）\n\n<page>\n${pageText.slice(0, 80000)}\n</page>`,
    }],
    output_config: { format: zodOutputFormat(Extraction) },
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { ok: false, reason: response.stop_reason === 'refusal' ? 'model declined' : 'no structured output' };
  }
  return { ok: true, exhibitions: response.parsed_output.exhibitions };
}
