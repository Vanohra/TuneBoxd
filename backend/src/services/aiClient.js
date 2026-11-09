/**
 * Thin wrapper around the Google Gemini API (free tier) for the AI features:
 * recommendation reasons (#13), listening summaries (#14), Ask TuneBoxd
 * discovery, the moderation assistant and album review digests.
 *
 * The AI features always work without it: recommendations are chosen from
 * TuneBoxd's own data and summaries are built from listening statistics. When
 * GEMINI_API_KEY is set, Gemini rewrites that output in natural language.
 * Any failure (no key, network, rate limit, safety block, bad JSON) returns
 * null and the caller keeps its rule-based text, so the API never breaks a page.
 *
 * Only music data is sent: titles, artists, counts, ratings, a user's own
 * review excerpts, public review text (digests, moderation) and discovery
 * requests. Never emails, passwords or account details.
 * Google may use free-tier prompts to improve its products.
 */
import { config } from '../config.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;
// Current Gemini models "think" before answering, and those thinking tokens
// count against maxOutputTokens. Without this headroom a long answer gets cut
// off (finishReason MAX_TOKENS) before the JSON is complete.
const THINKING_HEADROOM_TOKENS = 8000;

export function isAiConfigured() {
  return Boolean(config.ai.apiKey);
}

/** The answer text, without any "thought" parts or ```json fences around it. */
export function extractJsonText(candidate) {
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

/**
 * Asks Gemini for JSON matching `schema` (structured output).
 * `maxTokens` is the budget for the answer itself; thinking gets extra room.
 * @returns the parsed object, or null if the AI isn't available or anything failed.
 */
export async function generateJson({ system, prompt, schema, maxTokens = 2000 }) {
  if (!isAiConfigured()) return null;
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(config.ai.model)}:generateContent`, {
      method: 'POST',
      // The key goes in a header, never in the URL (URLs end up in logs).
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens + THINKING_HEADROOM_TOKENS,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          // Short writing tasks don't need deep reasoning; low thinking keeps
          // answers to a few seconds instead of timing out.
          ...(config.ai.thinkingLevel ? { thinkingConfig: { thinkingLevel: config.ai.thinkingLevel } } : {}),
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Google's own error message says what's wrong (bad key, unknown model,
      // quota). Never log the prompt (it contains user data) or the key.
      const body = await response.json().catch(() => ({}));
      console.error(`[ai] Gemini API error ${response.status} (model ${config.ai.model}): ${String(body.error?.message ?? '').slice(0, 300)}`);
      return null;
    }
    const data = await response.json();
    if (data.promptFeedback?.blockReason) {
      console.error(`[ai] Gemini blocked the prompt (${data.promptFeedback.blockReason})`);
      return null;
    }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.error(`[ai] Gemini stopped early (${candidate.finishReason}, model ${config.ai.model})`);
      return null;
    }
    const text = extractJsonText(candidate);
    if (!text) {
      console.error(`[ai] Gemini returned no text (model ${config.ai.model})`);
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      console.error(`[ai] Gemini returned invalid JSON (${text.length} characters, model ${config.ai.model})`);
      return null;
    }
  } catch (err) {
    console.error(`[ai] ${err.name}: ${err.message}`);
    return null;
  }
}
