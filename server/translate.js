// Translator: puts news headlines and short summaries into Russian and Ukrainian for the RU and UK editions.
// One cheap model call for a whole batch gives both languages; every text is translated once and kept in memory.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = 'claude-haiku-5-5';
const done = new Map(); // English text -> { ru, uk }
const MAX_TEXT = 600;   // summaries are cut so one long feed item cannot blow up the bill

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'ru', 'uk'],
        properties: { id: { type: 'integer' }, ru: { type: 'string' }, uk: { type: 'string' } }
      }
    }
  }
};

const SYSTEM = `You translate news headlines and short news summaries for Russian-speaking and Ukrainian-speaking crypto traders.
Translate each text twice, with exactly the same meaning: ru is natural, plain Russian, uk is natural, plain Ukrainian (real Ukrainian words and spelling, not Russian with a few letters changed). Add nothing, explain nothing.
Keep tickers, company, product and protocol names as they are usually written (BTC, Aave V4, Solana, Nasdaq); the Fed is ФРС in Russian and ФРС США in Ukrainian.
Keep numbers and amounts. Use only the plain hyphen, never long dashes. Return every id once.`;

// texts: array of English strings. Returns { ru: Map(text -> russian), uk: Map(text -> ukrainian), usage, model }.
// Texts already translated cost nothing; on any failure the caller keeps the English.
export async function translate(texts) {
  const todo = [...new Set(texts.filter(t => t && !done.has(t)))].map(t => t.slice(0, MAX_TEXT));
  let usage = null;
  if (todo.length) {
    const lines = todo.map((t, i) => `[${i}] ${t}`).join('\n');
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: lines }]
    }, { timeout: 30000, maxRetries: 0 });
    const text = res.content.find(b => b.type === 'text');
    if (!text) throw new Error('The translator returned nothing.');
    for (const { id, ru, uk } of JSON.parse(text.text).items) {
      if (todo[id] && ru) done.set(texts.find(t => t.slice(0, MAX_TEXT) === todo[id]), { ru, uk: uk || '' });
    }
    usage = res.usage;
    if (done.size > 2000) done.delete(done.keys().next().value);
  }
  const have = texts.filter(t => done.has(t));
  return {
    ru: new Map(have.map(t => [t, done.get(t).ru])),
    uk: new Map(have.filter(t => done.get(t).uk).map(t => [t, done.get(t).uk])),
    usage, model: MODEL
  };
}
