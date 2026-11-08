/**
 * Thin wrapper around the Claude API for the AI features (#13, #14).
 *
 * The AI features always work without it: recommendations are chosen from
 * TuneBoxd's own data and summaries are built from listening statistics. When
 * ANTHROPIC_API_KEY is set, Claude rewrites that output in natural language.
 * Any failure (no key, network, rate limit, refusal, bad JSON) returns null and
 * the caller keeps its rule-based text, so the API never breaks a page.
 *
 * Only aggregated music data is sent (titles, artists, counts, ratings, the
 * user's own review excerpts). Never emails, passwords or other users' data.
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client = null;

export function isAiConfigured() {
  return Boolean(config.ai.apiKey);
}

function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.ai.apiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * Asks Claude for JSON matching `schema` (structured outputs).
 * @returns the parsed object, or null if the AI isn't available or anything failed.
 */
export async function generateJson({ system, prompt, schema, maxTokens = 2000 }) {
  if (!isAiConfigured()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: config.ai.model,
      max_tokens: maxTokens,
      // Short, low-stakes writing: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    const text = response.content.find((block) => block.type === 'text')?.text;
    return text ? JSON.parse(text) : null;
  } catch (err) {
    // Log the kind of failure only; never the prompt (it contains user data).
    if (err instanceof Anthropic.APIError) console.error(`[ai] Claude API error ${err.status ?? ''} ${err.name}`);
    else console.error(`[ai] ${err.name}: ${err.message}`);
    return null;
  }
}
