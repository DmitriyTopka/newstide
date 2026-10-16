// Analyst: sends the numbered dispatches to the model and gets back one verdict in a fixed shape.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['direction', 'plan_fit', 'verdict', 'spot_futures_note', 'chain'],
  properties: {
    direction: { type: 'string', enum: ['up', 'down', 'sideways'] },
    plan_fit: { type: 'string', enum: ['supports', 'mixed', 'against'] },
    verdict: { type: 'string', description: 'Newspaper headline, at most 6 words, no numbers or percent.' },
    spot_futures_note: { type: 'string', description: 'One short sentence on how spot and futures may differ.' },
    chain: {
      type: 'array',
      description: 'Cause and effect from the wide picture down to the coin, 2 to 5 steps.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'cites'],
        properties: {
          step: { type: 'string', description: 'One sentence.' },
          cites: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the dispatches this step relies on.' }
        }
      }
    }
  }
};

const SYSTEM = `You are the news editor of NewsTide, a one-page newspaper for crypto traders.
A trader is about to open a trade and gives you the coin, the plan (long or short) and the horizon.
You get numbered dispatches: the coin's official project news (kind project), crypto headlines that name the coin (kind coin), other crypto market news and macro news.

Judge only from these dispatches. Do not use outside knowledge of prices or events.
Build a short chain of cause and effect from the wider picture (macro, the whole crypto market) down to this coin,
and cite the dispatch numbers each step relies on. Every step must cite at least one dispatch.

direction: where the news background is likely to push the coin over the horizon (up, down, sideways).
plan_fit: supports if the direction matches the plan, against if it opposes it, mixed when sideways or unclear.
verdict: a newspaper headline of at most 6 words, such as "Growth expected for ETH", "Correction for SOL" or "Neutral for now". No numbers, no percent signs.
spot_futures_note: one short sentence; futures react faster and amplify moves, spot is calmer.
When the wider picture is mixed but the coin's own official news is clearly positive or clearly negative, let that news decide the direction and say so in the chain.
Choose sideways only when the coin's own news is thin or balanced and the wider picture gives no clear push either way.`;

export function buildPrompt({ coin, plan, horizon, items }) {
  const window = horizon === 'intraday' ? 'the next hours (intraday, today\'s news)' : 'the next days (medium term, last two weeks of news)';
  const lines = items.map(it => `[${it.n}] (${it.kind}, ${it.source}, ${it.date.slice(0, 10)}) ${it.title}${it.summary ? ` - ${it.summary.slice(0, 240)}` : ''}`);
  return `Coin: ${coin.symbol} (${coin.name})\nPlan: ${plan}\nHorizon: ${window}\n\nDispatches:\n${lines.join('\n')}`;
}

export async function analyze({ coin, plan, horizon, items, model }) {
  const params = {
    model,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt({ coin, plan, horizon, items }) }]
  };
  // Sonnet 5.5: a rare safety refusal reroutes on the server instead of failing.
  const res = model === 'claude-sonnet-5-5'
    ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { timeout: 55000, maxRetries: 0 })
    : await client.messages.create(params, { timeout: 55000, maxRetries: 0 });
  if (res.stop_reason === 'refusal') throw new Error('The model declined to judge this edition.');
  const textBlock = res.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('The model returned no answer.');
  return { answer: JSON.parse(textBlock.text), usage: res.usage, model: res.model };
}
