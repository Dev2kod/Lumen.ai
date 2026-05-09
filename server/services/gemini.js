const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MAX_INPUT_WORDS = 12_000;
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

const promptCache = new Map();
function loadPrompt(name) {
  if (promptCache.has(name)) return promptCache.get(name);
  const file = path.join(PROMPTS_DIR, `${name}.txt`);
  const text = fs.readFileSync(file, 'utf8');
  promptCache.set(name, text);
  return text;
}

function truncateToWords(text, max = MAX_INPUT_WORDS) {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= max) return text;
  console.warn(
    `[gemini] truncating input from ${words.length} to ${max} words`
  );
  return words.slice(0, max).join(' ');
}

// Per-user-keyed FIFO queue. Each user gets their own rate-limit queue
// (15 req/min on Gemini free tier is per key, not global) so one user's
// generation can't throttle another's.
class RateQueue {
  constructor({ interval = 60_000, intervalCap = 14 } = {}) {
    this.interval = interval;
    this.intervalCap = intervalCap;
    this.timestamps = [];
    this.tail = Promise.resolve();
  }

  add(fn) {
    const run = this.tail.then(async () => {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.interval);
      if (this.timestamps.length >= this.intervalCap) {
        const wait = this.interval - (now - this.timestamps[0]) + 50;
        await new Promise((r) => setTimeout(r, wait));
      }
      this.timestamps.push(Date.now());
      return fn();
    });
    this.tail = run.catch(() => {});
    return run;
  }
}

const queuesByKey = new Map();
function queueFor(apiKey) {
  if (!queuesByKey.has(apiKey)) {
    queuesByKey.set(apiKey, new RateQueue({ interval: 60_000, intervalCap: 14 }));
  }
  return queuesByKey.get(apiKey);
}

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

async function callOnce({ apiKey, promptName, content, vars = {}, json }) {
  const template = loadPrompt(promptName);
  let filled = template;
  if (content !== undefined) {
    filled = filled.replace('{{content}}', truncateToWords(content));
  }
  for (const [key, val] of Object.entries(vars)) {
    filled = filled.replaceAll(`{{${key}}}`, String(val));
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: json
      ? { responseMimeType: 'application/json' }
      : undefined,
  });

  const result = await model.generateContent(filled);
  const text = result.response.text();

  if (!json) return text.trim();

  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned);
}

function cleanError(err, promptName, json) {
  const raw = err?.message || String(err);

  if (/API[_ ]KEY[_ ]INVALID|API key not valid/i.test(raw)) {
    const e = new Error(
      'Your Gemini API key is invalid. Update it on the Settings page — get a new one at https://aistudio.google.com/apikey.'
    );
    e.status = 401;
    e.code = 'BAD_GEMINI_KEY';
    return e;
  }
  if (/PERMISSION_DENIED|API_KEY_HTTP_REFERRER_BLOCKED/i.test(raw)) {
    const e = new Error(
      "Gemini rejected the request: your API key doesn't have permission for this model. Check the key's restrictions in Google AI Studio."
    );
    e.status = 403;
    e.code = 'BAD_GEMINI_KEY';
    return e;
  }
  if (/RESOURCE_EXHAUSTED|quota|rate limit/i.test(raw)) {
    const e = new Error(
      'Gemini rate limit hit. Wait a minute and try again — the free tier allows 15 requests per minute.'
    );
    e.status = 429;
    return e;
  }
  if (err instanceof SyntaxError || /JSON/.test(raw)) {
    const e = new Error(
      `The model returned malformed output for "${promptName}". Try again — this is usually transient.`
    );
    e.status = 502;
    return e;
  }

  const e = new Error(
    json
      ? `Couldn't generate ${promptName}. Try again in a moment.`
      : `The model call for ${promptName} failed. Try again in a moment.`
  );
  e.status = 502;
  return e;
}

async function runGemini({ apiKey, promptName, content, vars, json = false }) {
  if (!apiKey) {
    const e = new Error(
      'Add your Gemini API key on the Settings page to start generating.'
    );
    e.status = 400;
    e.code = 'MISSING_GEMINI_KEY';
    throw e;
  }

  return queueFor(apiKey).add(async () => {
    try {
      return await callOnce({ apiKey, promptName, content, vars, json });
    } catch (firstErr) {
      console.warn(
        `[gemini] ${promptName} failed (${firstErr.message}) — retrying once`
      );
      try {
        return await callOnce({ apiKey, promptName, content, vars, json });
      } catch (secondErr) {
        console.error(`[gemini] ${promptName} failed twice:`, secondErr);
        throw cleanError(secondErr, promptName, json);
      }
    }
  });
}

module.exports = { runGemini };
