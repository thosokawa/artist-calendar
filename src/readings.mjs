// Hiragana readings for artist and museum names written in kanji, so people can find
// 吉田博 by typing よしだ. Asks Claude only for names that do not have a reading yet.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { recordUsage } from './usage.mjs';

const MODEL = process.env.READINGS_MODEL ?? 'claude-sonnet-5-5';
const BATCH = 120;

export const hasKanji = (s) => /[㐀-鿿豈-﫿々〆]/.test(String(s));

const Readings = z.object({
  readings: z.array(z.object({
    id: z.string(),
    kana: z.string().describe('The usual reading in hiragana only, no spaces, e.g. "よしだひろし"'),
  })),
});

const SYSTEM = `日本語の人名・美術館名の読みがなを答えます。
- 読みはひらがなだけで、空白や記号を入れずに書きます。
- 人名は「姓名」の順の読み（例：吉田博 → よしだひろし、葛飾北斎 → かつしかほくさい）。号や雅号はその通称の読み。
- 中国・韓国などの人名は、日本で一般的な読み（例：米芾 → べいふつ）。
- ローマ字表記が添えてあれば、読みの手がかりにしてください。
- カタカナやアルファベットの部分は、その読みをひらがなにします。`;

// items: [{ id, name, hint }] -> Map(id -> kana)
export async function fetchReadings(items, { client = new Anthropic() } = {}) {
  const out = new Map();
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: batch.map((x) => `${x.id}\t${x.name}${x.hint ? `\t${x.hint}` : ''}`).join('\n') }],
      output_config: { effort: 'low', format: zodOutputFormat(Readings) },
    });
    recordUsage(MODEL, response.usage);
    for (const r of response.parsed_output?.readings ?? []) {
      const kana = r.kana.normalize('NFKC').replace(/[\s・･]/g, '');
      if (/^[ぁ-ゖー]+$/.test(kana)) out.set(r.id, kana);
    }
  }
  return out;
}
