// Token use of every Claude call in a run, printed at the end so a bill can be traced to its job.
// $ per million tokens (input, output); a rough guide, not the invoice.
const PRICE = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
const totals = {};

export function recordUsage(model, usage) {
  if (!usage) return;
  const t = (totals[model] ??= { calls: 0, input: 0, output: 0, searches: 0 });
  t.calls += 1;
  t.input += (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  t.output += usage.output_tokens ?? 0;
  t.searches += usage.server_tool_use?.web_search_requests ?? 0;
}

export function usageSummary() {
  return Object.entries(totals).map(([model, t]) => {
    const [pi, po] = PRICE[model] ?? [0, 0];
    // Web search: $10 per 1,000 searches, on top of the tokens its results add.
    const usd = (t.input * pi + t.output * po) / 1e6 + t.searches * 0.01;
    return `Claude usage ${model}: ${t.calls} calls, ${t.input} input / ${t.output} output tokens${t.searches ? `, ${t.searches} searches` : ''} ≈ $${usd.toFixed(2)}`;
  }).join('\n') || 'Claude usage: none';
}
