// Original Japanese descriptions for venue and exhibition pages, written from the official page
// (never copied from it), so each page tells a reader something beyond dates and names.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { recordUsage } from './usage.mjs';

const MODEL = process.env.DESCRIBE_MODEL ?? 'claude-haiku-5-5';

const Text = z.object({
  text: z.string().describe('Japanese prose in your own words; empty string if the page does not say enough'),
});

const RULES = `- ページの文章を写さず、自分の言葉で書きます。文を並べ替えたり語尾を変えただけの言い換えも避けます。
- ページに書かれていることだけを使います。推測や一般論で補いません。
- 料金・開館時間・予約方法は書きません（変わるため）。
- 宣伝文句（「必見」「話題の」など）は使わず、です・ます調の落ち着いた文にします。
- 「ページには」「公式サイトでは」「〜とされています」のように情報源に触れず、施設や展覧会そのものを直接説明します。
- わからないことには触れません（「〜は読み取れません」などと書かない）。
- ページの情報が足りなければ text を空にします。`;

async function ask(system, content, client) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(Text) },
  });
  recordUsage(MODEL, response.usage);
  return (response.parsed_output?.text ?? '').trim();
}

export function describeVenue({ venue, pageText, client = new Anthropic() }) {
  const kind = venue.kind === 'gallery' ? 'ギャラリー' : '美術館';
  return ask(`${kind}の公式サイトの文章を読み、その${kind}がどんな場所かを紹介する文を3〜4文（120〜220字）で書きます。
- 何を中心に扱う館か（時代・分野・コレクションの特色）、成り立ち、建物や立地の特徴など、訪れる人の役に立つことを書きます。
${RULES}`, `${kind}: ${venue.name}（${venue.prefecture}${venue.city ?? ''}）\n\n<page>\n${pageText.slice(0, 30000)}\n</page>`, client);
}

export function describeExhibition({ exhibition, venue, artistNames, pageText, client = new Anthropic() }) {
  return ask(`展覧会の公式ページを読み、その展覧会の内容と見どころを紹介する文を150〜250字で書きます。
- どんな作品・作家・テーマを、どんな切り口で見せる展覧会かを具体的に書きます。
- 展覧会名と会期はページの別の場所に出るので、繰り返さなくて構いません。
- ページが複数の展覧会の一覧なら、指定された展覧会についての部分だけを使います。その展覧会について題名と会期しか書かれていなければ text を空にします。
${RULES}`, `展覧会: ${exhibition.title}\n会場: ${venue.name}\n作家: ${artistNames.join('、') || '（記載なし）'}\n\n<page>\n${pageText.slice(0, 30000)}\n</page>`, client);
}
