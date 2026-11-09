/**
 * Checks that the Gemini key in .env (GEMINI_API_KEY) works: sends one small
 * structured-output request, the same way the AI features do, and prints
 * whether it worked. Never prints the key.
 *
 *   npm --prefix backend run check-ai
 *   npm --prefix backend run check-ai -- gemini-3.5-flash-lite   (try another model)
 */
import { config } from '../src/config.js';
import { generateJson, isAiConfigured } from '../src/services/aiClient.js';

if (process.argv[2]) config.ai.model = process.argv[2];

if (!isAiConfigured()) {
  console.error('GEMINI_API_KEY is not set. Add it to the repo-root .env file (see .env.example).');
  process.exit(1);
}

console.log(`Asking Gemini (model ${config.ai.model}, thinking ${config.ai.thinkingLevel ?? 'default'})...`);
const started = Date.now();
const result = await generateJson({
  system: 'You suggest music albums. Use real albums only.',
  prompt: 'Suggest 2 upbeat 80s pop albums for a road trip.',
  schema: {
    type: 'object',
    properties: {
      albums: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, artist: { type: 'string' } },
          required: ['title', 'artist'],
        },
      },
    },
    required: ['albums'],
  },
});
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (result?.albums?.length) {
  console.log(`It works (${seconds}s). Gemini suggested:`);
  for (const album of result.albums) console.log(`  - ${album.title} by ${album.artist}`);
} else {
  console.error(`It didn't work (${seconds}s). The [ai] line above says why.`);
  process.exitCode = 1;
}
