/**
 * Thin wrapper around the Google Gemini API (free tier) for the AI features
 * (#13 recommendation reasons, #14 listening summaries).
 *
 * The AI features always work without it: recommendations are chosen from
 * TuneBoxd's own data and summaries are built from listening statistics. When
 * GEMINI_API_KEY is set, Gemini rewrites that output in natural language.
 * Any failure (no key, network, rate limit, safety block, bad JSON) returns
 * null and the caller keeps its rule-based text, so the API never breaks a page.
 *
 * Only aggregated music data is sent (titles, artists, counts, ratings, the
 * user's own review excerpts). Never emails, passwords or other users' data.
 * Google may use free-tier prompts to improve its products.
 */
import { config } from '../config.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30_000;

export function isAiConfigured() {
  return Boolean(config.ai.apiKey);
}

/**
 * Asks Gemini for JSON matching `schema` (structured output).
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
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Log the status only; never the prompt (it contains user data) or the key.
      console.error(`[ai] Gemini API error ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data.promptFeedback?.blockReason) {
      console.error(`[ai] Gemini blocked the prompt (${data.promptFeedback.blockReason})`);
      return null;
    }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.error(`[ai] Gemini stopped early (${candidate.finishReason})`);
      return null;
    }
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('');
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error(`[ai] ${err.name}: ${err.message}`);
    return null;
  }
}
