# Lumen

A learn-to-teach engine. Drop in a YouTube video, an article URL, or pasted text — get back a summary, flashcards, a quiz, and ready-to-post drafts for LinkedIn and Twitter.

Single-user, local-only. No auth, no deploy. Built with React + Vite, Express, SQLite, and the Google Gemini API.

## Stack

- **Frontend** — React 18 + Vite, plain CSS with CSS variables
- **Backend** — Node.js + Express (CommonJS)
- **Database** — `node:sqlite` (built into Node 22.5+; no native compile step)
- **AI** — `gemini-2.0-flash` via `@google/generative-ai`
- **Type system** — none. Plain JavaScript everywhere.

## Setup

You need **Node.js 22.5+** (24+ recommended).

```bash
cp .env.example .env
# Open .env and paste your Gemini API key from
# https://aistudio.google.com/apikey

npm run install:all   # installs root, server, and client deps
npm run dev           # starts server on :5050 and client on :5173
```

Then open <http://localhost:5173>.

## Project layout

```
lumen/
├── server/                        Express + node:sqlite + Gemini
│   ├── index.js
│   ├── routes/
│   │   ├── sources.js             POST/GET/DELETE sources
│   │   ├── learning.js            POST /:id/learning
│   │   └── repurpose.js           POST /:id/repurpose
│   ├── services/
│   │   ├── db.js                  schema + prepared statements
│   │   ├── gemini.js              SDK + queue + retry + JSON parsing
│   │   └── ingestion.js           YouTube + article + text
│   └── prompts/                   plain .txt files, edit freely
└── client/                        React + Vite SPA
    └── src/
        ├── pages/                 LibraryPage, NewSourcePage, SourcePage
        ├── components/            Button, Tabs, Flashcard, QuizQuestion, …
        ├── styles/                variables.css, global.css, components.css
        └── api.js
```

## Editing prompts

Prompts live as plain text files in `server/prompts/`. The string `{{content}}` is replaced with the source content at runtime. Edit them, save, and the next generation will pick up the change automatically (no server restart needed — they're cached the first time they're read, but the cache resets each `node --watch` reload).

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/sources` | — | `{ sources: [...] }` |
| `POST` | `/api/sources` | `{ type, url?, text? }` | `{ source }` |
| `GET` | `/api/sources/:id` | — | `{ source, learning, repurposes }` |
| `DELETE` | `/api/sources/:id` | — | `204` |
| `POST` | `/api/sources/:id/learning` | — | `{ learning: { summary, flashcards, quiz } }` |
| `POST` | `/api/sources/:id/repurpose` | `{ format: "linkedin" \| "twitter" }` | `{ repurpose }` |

## Notes & limits

- **Token budget** — inputs over 12,000 words are truncated. The server logs a warning when this happens.
- **Rate limiting** — Gemini's free tier allows 15 req/min. The server caps itself at 14 req/min via an in-process queue (concurrency: 1).
- **YouTube** — uses public transcripts. Videos with auto-captions disabled or behind a paywall will fail with a clear error.
- **Articles** — fetched via Mozilla Readability. Sites that hard-block bots (Cloudflare, paywalls) won't extract — paste the text instead.
- **No auth** — anyone with access to `localhost:5173` is "the user". Single-tenant by design.

## Why `node:sqlite` instead of `better-sqlite3`?

The original spec called for `better-sqlite3`, which requires a C++ build. On Node 24 (current latest), prebuilds aren't yet available, and Windows boxes without Visual Studio Build Tools fail to compile. `node:sqlite` is built into Node 22.5+, has the same synchronous API, and needs no native compile step. It's stable in Node 24.5+.
