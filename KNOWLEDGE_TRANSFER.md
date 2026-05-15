# Lumen — Knowledge Transfer

A complete walkthrough of the Lumen codebase, written for two audiences at once: future-you copying bullets onto a resume, and interview-you walking a hiring manager through a real production-shaped project.

The setup quickstart still lives in `README.md`. This document focuses on **what was built, why, and how**.

---

## 1. Project at a Glance

Lumen is a **learn-to-teach engine**. A user pastes a YouTube URL, an article URL, or raw text, and Lumen turns that source into a complete learning kit: an AI-written summary, flashcards grouped by topic, a multiple-choice quiz, a chat surface for asking follow-up questions grounded in the source, and ready-to-post LinkedIn and Twitter drafts written from a chosen angle.

The application is intentionally lean. It runs locally on a single machine, but it is no longer a single-user toy — a recent rewrite (commit `229ea8e — auth added`) introduced a real auth layer, multi-user data scoping, and encrypted per-user API key storage. The result is a small, opinionated, full-stack codebase that touches modern auth, AI integration, content extraction, rate-limited third-party API consumption, and a hand-rolled design system.

**Stack at a glance.** React 18 + Vite + Tailwind v4 on the client; Node.js + Express on the server; SQLite via the built-in `node:sqlite` module; Google Gemini 2.0 Flash for all generative work; magic-link email sign-in backed by 30-day JWTs; AES-256-GCM encryption for the per-user "bring-your-own-key" Gemini secret. No TypeScript, no ORM, no UI component library, no test suite — each of those is a deliberate trade-off explained later in this document.

**Current state.** Feature-complete v0 plus auth. Three commits on `main`: `43b4ddd` and `9fe12e2` shipped the core generation pipeline; `229ea8e` added passwordless multi-user auth.

---

## 2. Headline Resume Bullets

Each line is copy-paste ready. Trim or merge to taste.

- Designed and shipped a full-stack AI learning tool (React 18 + Vite SPA, Node/Express API, SQLite, Google Gemini 2.0 Flash) that ingests YouTube transcripts, web articles, and raw text and generates summaries, topic-grouped flashcards, quizzes, grounded Q&A, and LinkedIn/Twitter drafts.
- Implemented passwordless magic-link authentication with one-shot atomic token consumption (15-minute expiry, conditional SQL update guarantees a link cannot be redeemed twice) and 30-day stateless JWT sessions.
- Built a BYOK (bring-your-own-key) credential system that encrypts each user's Gemini API key at rest with AES-256-GCM using a separate ciphertext/IV/auth-tag column trio, decrypting on demand inside the auth middleware after JWT verification.
- Engineered a per-API-key FIFO rate-limit queue (capped at 14 requests per minute, just under Gemini's free-tier ceiling of 15) so one user's bursty generation cannot starve another user's requests, with a two-attempt retry strategy and classified error mapping for invalid keys, permission errors, quota exhaustion, and malformed JSON.
- Wrote a multi-source ingestion pipeline supporting YouTube (regex video-ID extraction across watch, youtu.be, embed, and shorts URLs plus HTML-entity decoding of caption text), web articles (Mozilla Readability and jsdom with a browser-style User-Agent), and raw text, with a 12,000-word truncation guard before any model call.
- Authored eight editable Gemini prompt templates with `{{placeholder}}` substitution, in-memory caching, and JSON-output mode that strips code fences before parsing — enabling non-engineers to tune AI behavior without touching code.
- Modelled the data layer in SQLite (`node:sqlite`, no native compile step) across eight STRICT tables with WAL journaling, foreign-key enforcement, around thirty pre-compiled prepared statements, and inline schema evolution via `PRAGMA table_info` plus conditional `ALTER TABLE`.
- Built a single-page React frontend on React Router v6 with a `<Protected>` wrapper that preserves deep links via a `?next=` query parameter, auth state held in a Context provider (deliberately no Redux), and a hand-rolled fetch wrapper that injects the Bearer token and exposes a structured error code for branching client behaviour.
- Designed a custom Tailwind v4 design system using CSS-variable design tokens, attribute-driven dark mode (`[data-theme="dark"]` rather than utility-class duplication), self-hosted variable fonts (Bricolage Grotesque, Plus Jakarta Sans, JetBrains Mono), bespoke `@keyframes` animations that respect `prefers-reduced-motion`, and `clamp()`-based responsive typography.
- Made and defended a set of deliberate engineering trade-offs (no TypeScript, no ORM, no React Query, no UI library, no automated tests) that kept the codebase small enough for a single developer to ship the full vertical slice without sacrificing security or correctness.

---

## 3. STAR Breakdowns by Skill Area

Each subsection follows the Situation → Task → Action → Result pattern. Read top-to-bottom for an end-to-end tour, or jump to the area an interviewer is probing.

### 3.1 Passwordless Auth — Magic Link plus JWT

**Situation.** Lumen began as a single-user, local-only tool with no authentication. The product direction required multiple users to coexist on the same instance (each with their own sources, chats, and Gemini key) without standing up an OAuth provider, a passwords table, a password-reset flow, or a third-party auth service.

**Task.** Add real auth that scoped every piece of user data, kept passwords entirely off the box, survived multi-tab and deep-link navigation, and degraded gracefully in local development where no email provider is configured.

**Action.** Implemented a magic-link flow end-to-end. The login route validates the email, issues a 32-byte hex token, persists it in a `magic_links` row with a fifteen-minute expiry, and either sends the link through Resend's HTTP API or — if `RESEND_API_KEY` is missing — logs the link to the server console for local development. The verify route consumes the token atomically: a single conditional update marks the row used only when it is unexpired and unused, so a second click on the same email link cannot ever succeed. On the first successful verification of any account, an inline "first-user claim" sweeps every pre-existing orphaned source onto that user. Sessions are stateless 30-day JWTs signed with `ENCRYPTION_KEY` (or a separate `JWT_SECRET` if provided). The login response intentionally returns the same shape regardless of whether the email is registered, so email-enumeration probing is impossible. A `<Protected>` wrapper on the client redirects unauthenticated users to `/login?next=<original-path>` so deep links survive the round trip.

**Result.** Production-shaped auth with no passwords to leak, no reset flow to maintain, and an attack surface measured in lines of code rather than dependencies. Source files: `server/routes/auth.js`, `server/services/auth.js`, `server/middleware/requireAuth.js`, `client/src/hooks/useAuth.jsx`, `client/src/pages/LoginPage.jsx`, `client/src/pages/AuthCallbackPage.jsx`.

### 3.2 BYOK — Encrypted Per-User API Key Storage

**Situation.** Every user needs to talk to Google Gemini, and the project deliberately rejected the "one shared API key on the server" model — both because Gemini's free tier is per-key (so usage by one user would slow down everyone else) and because storing a single shared secret in plain text is exactly the kind of foot-gun you do not want sitting in a repo.

**Task.** Let each user supply their own Gemini API key through the Settings page, store it durably and confidentially, and make sure it is only ever decrypted on a code path that has already been authenticated.

**Action.** Built an AES-256-GCM encryption helper that returns a triple of base64-encoded ciphertext, IV, and authentication tag — each persisted to a separate column on the `users` row. The encryption key is loaded from a `ENCRYPTION_KEY` environment variable that is validated to be exactly 32 bytes (64 hex characters); the loader throws on startup if it is missing or malformed, so a misconfigured deploy fails fast rather than silently writing weakly encrypted ciphertext. Decryption happens inside the `requireAuth` middleware, which runs strictly after JWT verification — meaning the plaintext key is only ever materialised on a request that has already been authenticated for a specific user. When a generation route runs without a stored key, the server returns a 400 with the structured code `MISSING_GEMINI_KEY`, which the client uses to nudge the user to the Settings page instead of showing a generic error toast.

**Result.** Keys are never logged, never returned over the wire after upload, and never touched outside an authenticated middleware-driven decryption. The `MISSING_GEMINI_KEY` code lets the UI guide the user to fix the configuration with one click. Source files: `server/services/auth.js`, `server/middleware/requireAuth.js`, `server/routes/auth.js`, `client/src/pages/SettingsPage.jsx`.

### 3.3 Multi-Source Ingestion

**Situation.** The product's premise is that you can drop in *anything* — a YouTube link, an article URL, or raw text — and Lumen does the rest. That means three different content pipelines all need to land in the same `raw_content` column on the `sources` table.

**Task.** Extract clean, model-ready text from each input type, with sensible errors when the source cannot be processed (transcripts disabled, bot-blocked sites, empty pastes) and a hard word limit before any AI call.

**Action.** Built three branches in `server/services/ingestion.js`. The YouTube branch parses video IDs out of the four canonical URL shapes (watch, youtu.be, embed, shorts) with a single tolerant regex, fetches captions via the `youtube-transcript` npm package, then runs the result through an HTML-entity decoder that handles YouTube's inconsistent double-encoding. The article branch fetches the page with a browser-style User-Agent (so bot-defence won't reject it outright), feeds the HTML into Mozilla Readability via jsdom, and falls back to plain body text if Readability cannot identify an article container. The text branch enforces a minimum length so empty pastes never reach the model. Errors are surfaced as a typed `IngestionError` with HTTP status 422 and a human-readable message ("This video doesn't have captions enabled" rather than a stack trace). All three pipelines normalise whitespace and feed a 12,000-word truncation guard before any model call.

**Result.** Users can ingest essentially any source with one paste, and failures explain themselves in plain English. Source file: `server/services/ingestion.js`.

### 3.4 Gemini Integration — Prompts, Queue, Retry

**Situation.** Every meaningful operation in Lumen — summarising, generating flashcards, generating quiz questions, answering follow-up questions, suggesting topics, suggesting repurpose angles, writing LinkedIn drafts, writing Twitter drafts — is a call to the same model. Doing this badly means tight coupling between routes and the SDK, brittle JSON parsing, no rate-limit story, and prompts that only engineers can edit.

**Task.** Build one thin abstraction that all eight prompt types flow through, with templating, rate limiting, retry, JSON parsing, and meaningful error mapping.

**Action.** Wrote `server/services/gemini.js` as the single entry point. All eight prompts live as plain `.txt` files in `server/prompts/` (summary, flashcards, flashcard-topics, quiz, ask, repurpose-angles, linkedin, twitter) with `{{content}}`, `{{topic}}`, `{{question}}`, and `{{angle}}` placeholders that the wrapper substitutes at runtime. Prompts are read from disk once and cached in a Map; `node --watch` resets the cache so a developer can edit prompts and see the change on the next request without restarting manually. A `RateQueue` class enforces a sliding window of 14 requests per minute (one below Gemini's free-tier ceiling of 15) per API key — implemented as a Promise tail-chain that records timestamps, filters them by the window, and `await`s the remaining delay before the next call. Crucially the queue map is keyed by API key, not globally, so two users with separate Gemini keys do not compete for slots. Every call goes through a two-attempt retry: the first failure logs a warning and retries silently; the second failure is classified by message-pattern matching into one of four buckets (`BAD_GEMINI_KEY` for `API_KEY_INVALID` and `PERMISSION_DENIED`, a 429 for `RESOURCE_EXHAUSTED`, a 502 for malformed JSON, a generic 502 for the long tail) and surfaced to the client as a friendly message plus a structured code. JSON-mode prompts pass through a `stripCodeFences` pass before `JSON.parse` because Gemini occasionally wraps JSON responses in triple-backtick fences even when asked not to.

**Result.** A new prompt is a new `.txt` file and a one-line call; no engineer touches SDK code. Rate-limit failures are isolated per user. Bad keys, quota exhaustion, and malformed responses each have their own actionable error message. Source files: `server/services/gemini.js`, `server/prompts/` (eight files).

### 3.5 Learning Artifacts and RAG Q&A

**Situation.** The user clicks "Generate learning" once and expects a complete artifact set — summary, flashcards, quiz — with optional follow-on questions answered against the same source content. Doing these sequentially would be slow and would force the user to wait on optional enrichment that they may never look at.

**Task.** Generate the three primary artifacts in parallel, kick off background best-effort enrichments without blocking the primary response, and provide a question-answering surface that is grounded in the original source content.

**Action.** The `POST /api/sources/:id/learning` route fires the three primary Gemini calls (summary, flashcards on the default "Overview" topic, quiz) in parallel and persists them into `learning_artifacts`. Two non-blocking background calls — flashcard-topic suggestions and repurpose-angle suggestions — are awaited but their failures are caught and logged rather than propagated. If they succeed, the suggestions are cached on the source row as JSON arrays; if they fail, the user can still pick a flashcard topic manually and the regenerate-with-custom-topic flow still works. The Q&A surface (`POST /api/sources/:id/ask`) is a small RAG-style pattern: the `ask.txt` prompt receives the full `raw_content` plus the user's question and is asked to answer in roughly 200 words of markdown, drawing only from the provided content. Question/answer pairs are persisted to the `chats` table with a `starred` flag, and the `DELETE /api/sources/:id/chats/:chatId` route enforces a "starred chats cannot be deleted" rule server-side (the client also disables the delete button), so an accidental click cannot lose a chat the user explicitly saved.

**Result.** The primary user journey resolves with a single round trip; optional enrichment is best-effort; and the star-protect rule prevents accidental destruction of valuable content. Source files: `server/routes/learning.js`, `server/routes/chat.js`, `client/src/pages/SourcePage.jsx`.

### 3.6 Social Repurpose with Angle Selection

**Situation.** Generating a single generic LinkedIn post off a source is uninteresting; what makes the feature feel intelligent is letting the user say "write this from a *contrarian* angle" or "write this for *first-time engineering managers*", and seeing the same source reshaped accordingly.

**Task.** Offer suggested angles automatically, allow the user to type their own, persist every generation, and keep the LinkedIn and Twitter formats first-class.

**Action.** Angle suggestions are generated by the `repurpose-angles.txt` prompt as a background best-effort job during the initial learning generation; the result is cached on `sources.repurpose_angles` as a JSON array. The Repurpose tab on the source page surfaces those as chips, and a text input lets the user type a custom angle. The `POST /api/sources/:id/repurpose` route accepts `{ format, angle }` and dispatches to either `linkedin.txt` (long-form post) or `twitter.txt` (numbered thread of short tweets), passing both `{{content}}` and `{{angle}}` into the prompt. Every generation is appended to the `repurposes` table — nothing is overwritten — so the user can scroll back through versions and pick the one that landed best. A one-click `CopyButton` copies the result to the clipboard with a brief "copied" confirmation.

**Result.** Repurposing feels like an editorial collaborator rather than a button. The history-keeps-everything model means experimentation is free. Source files: `server/routes/repurpose.js`, `server/prompts/linkedin.txt`, `server/prompts/twitter.txt`, `server/prompts/repurpose-angles.txt`, `client/src/pages/SourcePage.jsx`, `client/src/components/CopyButton.jsx`.

### 3.7 Data Layer — SQLite, WAL, Prepared Statements

**Situation.** A small full-stack app should not require a database server. But the project also needed real relational guarantees: cascading deletes when a source is removed, foreign-key enforcement, strictly typed columns, and atomic operations for the magic-link consumption flow.

**Task.** Pick a database that is zero-install on Windows and macOS, supports real SQL semantics, and does not require a native compile step on Node 24 (where the obvious choice, `better-sqlite3`, lacks prebuilt binaries and fails on machines without C++ build tooling).

**Action.** Adopted Node's built-in `node:sqlite` module (available on Node 22.5 and stable on 24.5+), giving a synchronous SQLite API with zero native compilation. Enabled WAL journaling and foreign-key enforcement on startup. Modelled the schema across eight STRICT-mode tables: `sources` (the input), `learning_artifacts` (generated summary/flashcards/quiz), `repurposes` (LinkedIn/Twitter drafts with angle), `chats` (Q&A history with star flag), `users` (account plus encrypted Gemini key columns), `magic_links` (one-shot sign-in tokens), `sessions` (placeholder for forward-compatible session-table auth), and `oauth_accounts` (placeholder for forward-compatible Google OAuth). Built around thirty pre-compiled prepared statements so every query has its SQL parsed once at startup and reused thereafter — both for performance and as an implicit SQL-injection guarantee, since user input is never concatenated into SQL. Complex types (flashcard sets, quiz, topic suggestions, angle suggestions) are stored as JSON text and parsed on retrieval. Schema migrations are handled inline: on startup, `PRAGMA table_info` lists each table's current columns, and any missing column is added with a conditional `ALTER TABLE`, so the schema can evolve without managing a separate migrations directory.

**Result.** Zero deployment friction (one `.sqlite` file), real relational guarantees, no native build step, and forward-compatible columns already in place for OAuth and server-side session revocation when those features are next needed. Source file: `server/services/db.js`.

### 3.8 Frontend Architecture

**Situation.** A modern React app can easily acquire a Redux store, a React Query layer, a forms library, a UI component library, a routing library, and a styling library before it has shipped a single screen. Lumen's scope did not justify that ceremony, and excess machinery was already showing up as friction in the early v0 iterations.

**Task.** Build a single-page React application that is small enough for one engineer to keep in their head, while still solving the real problems an SPA needs to solve: protected routes that survive deep links, a typed-feeling API surface, error handling that drives UI behaviour, and clean separation between transport and business logic.

**Action.** Used React Router v6 with a `<Protected>` HOC that consumes the auth context's `status` field (`'loading' | 'authed' | 'anon'`) and redirects anonymous users to `/login?next=<original-path>` so post-sign-in lands back where they started. Auth state lives in a single `AuthContext` provider — no Redux, no Zustand, no Jotai. The `useAuth` hook exposes a tight surface (`user`, `status`, `refresh`, `requestMagicLink`, `verifyMagicLink`, `logout`) that every page consumes directly. Per-page UI state stays as plain `useState`. The HTTP layer is a hand-rolled `request` function in `client/src/api.js` that prefixes `/api`, injects a Bearer token from a localStorage-backed `tokenStore` (try/catch wrapped so SSR or quota-exceeded states fail silently), parses JSON responses, and — critically — throws errors with a structured `.code` field copied from the server. That lets pages branch on `MISSING_GEMINI_KEY` (redirect to Settings), `EMAIL_TESTING_MODE` (show a domain-verification hint), and so on without parsing error message strings. The exported `api` object groups domain methods (`api.listSources()`, `api.askQuestion(id, q)`, `api.generateLearning(id)`) so pages call business-meaningful names rather than ad-hoc URL strings.

**Result.** A small, focused frontend where every page reads top-to-bottom, errors drive real UI behaviour, and there is no global state to debug except the user object. Source files: `client/src/App.jsx`, `client/src/api.js`, `client/src/hooks/useAuth.jsx`, `client/src/pages/` (seven pages).

### 3.9 Design System — Tailwind v4, CSS Variables, Dark Mode

**Situation.** A pleasant-looking interface is not optional for a tool the user is going to spend extended sessions in, and an inconsistent one undermines trust in the AI output it surfaces. The early v0 palette was warm cream and terracotta — and was scrapped because it read as Anthropic's brand language rather than Lumen's own identity.

**Task.** Build a cohesive design system with dark mode, distinctive typography, motion that respects accessibility settings, and zero dependency on a third-party UI library.

**Action.** Adopted Tailwind v4 with the `@tailwindcss/vite` plugin so there is no separate Tailwind build step. Defined the entire design vocabulary as CSS custom properties under a single `@theme` block — surfaces (canvas, surface, sunken, line, line-strong), ink colours (ink, muted, subtle), accent colours (cobalt blue and a soft tint), and the three font stacks (Bricolage Grotesque for display, Plus Jakarta Sans for body, JetBrains Mono for code/numbers). Dark mode is driven by a single `[data-theme="dark"]` attribute on the document element, which re-points the same CSS variables to their dark values — meaning a component author never writes a `dark:` utility class twice, and there is exactly one place in the codebase where dark colours are defined. Fonts are self-hosted via `@fontsource-variable` packages, which avoids the Google Fonts CDN and its privacy and render-blocking implications. Motion is built from a handful of named `@keyframes` (skeleton pulse, hero fade-up, drift, spark-float, plane-float, library-float, tab fade-in) that are gated by a `prefers-reduced-motion: reduce` media block, so users with the OS setting enabled get static UI. Responsive typography uses `clamp()` so headings scale smoothly between mobile and desktop without breakpoint jumps. The handful of UI primitives (`Button`, `Tabs`, `Flashcard`, `QuizQuestion`, `Skeleton`, `Spinner`, `EmptyState`, `CopyButton`, `Atmosphere`, `Illustration`) are all hand-built in this codebase — no shadcn, no Radix, no MUI.

**Result.** A small bespoke design system with strong personality, real dark mode, accessibility-respecting motion, and no external UI dependency. Source files: `client/src/styles/index.css`, `client/src/components/`, `client/src/App.jsx`.

### 3.10 Deliberate Trade-Offs (and How to Defend Them)

**Situation.** The project has several "missing" pieces that a reviewer is likely to flag: no TypeScript, no ORM, no React Query, no UI library, no automated tests. Each absence was a deliberate choice, not an oversight.

**Task.** Be ready to explain the reasoning behind each missing convention rather than apologising for it.

**Action and Result.** No TypeScript — the codebase is small (21 client source files, around two thousand server lines), API contracts are validated server-side at the boundary, and the iteration speed gain outweighed the type-safety loss at this scope. The right time to introduce TypeScript is when the codebase grows past one engineer's head, not preemptively. No ORM — prepared statements give the same SQL-injection guarantee with less indirection, and the schema is small enough that hand-written SQL is more readable than an ORM model. No React Query — the app has predictable, finite data flows with no real-time updates, no optimistic mutations, and no cross-page cache coherence problems; a hand-rolled fetch wrapper is sufficient and roughly fifty lines. No UI component library — design personality was a product requirement, and a bespoke set of ten primitives turned out smaller than the wiring code a library would have demanded. No automated tests — the most glaring gap, called out honestly: the test pyramid would start with unit tests on `ingestion.js` (URL parsing, entity decoding, Readability fallback), add integration tests on the magic-link flow against a temporary SQLite file, and end with a single Playwright happy-path covering source creation through learning generation through one Q&A. None of these decisions is permanent; each will tip the other way as the project grows.

---

## 4. Architecture Map — End-to-End Request Walkthrough

The clearest way to internalise the codebase is to follow one user action all the way down. Take the most representative case: a signed-in user clicks "Generate learning" on a freshly created source.

The click fires `api.generateLearning(id)` in `client/src/api.js`, which is a thin wrapper around `request('/sources/:id/learning', { method: 'POST' })`. The `request` function attaches the JWT from `tokenStore` as a Bearer header and dispatches the call.

The request reaches Express. The `requireAuth` middleware reads the Bearer token, verifies it with `verifyToken`, looks up the user row from the `users` table, decrypts the stored Gemini key with `decryptSecret`, and attaches both `req.user` and `req.geminiKey` to the request. If the key is missing, the middleware returns a 400 with code `MISSING_GEMINI_KEY` before the route handler ever runs.

The route handler in `server/routes/learning.js` loads the source row, checks that it belongs to `req.user.email`, and fires three parallel Gemini calls through `runGemini` in `server/services/gemini.js`: the summary prompt, the flashcards prompt (with topic `"Overview"`), and the quiz prompt. Each call is enqueued behind the per-API-key `RateQueue` — meaning if three calls would push the user over 14 requests in the last minute, the queue inserts a delay before the third one runs. JSON-mode calls strip code fences before `JSON.parse`. Plain-text calls are returned as a trimmed string.

When all three promises resolve, the handler writes a row to `learning_artifacts` with the summary text, the flashcards JSON, and the quiz JSON. It then kicks off two background best-effort calls (flashcard-topic suggestions, repurpose-angle suggestions) which it awaits but whose failures are caught and logged rather than propagated. If they succeed, the suggestions are written back to `sources.flashcard_topics` and `sources.repurpose_angles`.

The response body comes back to the client. The `SourcePage` component updates its local state with the new artifacts, the Summary tab renders the markdown through `react-markdown`, the Flashcards tab renders the cards through the `Flashcard` component with its CSS 3D flip animation, and the Quiz tab renders questions through `QuizQuestion`. The user sees the three tabs populate together.

That one flow exercises every meaningful layer in the codebase: client routing, the auth context, the fetch wrapper, the auth middleware, the encrypted key store, the prompt cache, the rate queue, the retry logic, the JSON parser, the database write, the background enrichment pattern, and the React component layer.

---

## 5. Tech Stack Reference

| Tech | What it does in this project |
|---|---|
| React 18 | Client-side rendering, hooks, context. The whole frontend is one SPA. |
| Vite | Dev server with HMR on port 5173 and the production bundler. A dev proxy forwards `/api` to the Node server. |
| React Router v6 | Client-side routing. A `<Protected>` wrapper guards authenticated routes and preserves the deep-link target via `?next=`. |
| Tailwind CSS v4 | Utility-first styling. Used through `@tailwindcss/vite` with no separate build. Design tokens live in CSS variables under `@theme`. |
| react-markdown | Renders the Gemini-generated summary and chat answers safely as HTML. |
| @phosphor-icons/react | Icon set used throughout the sidebar, tab bar, and buttons. |
| @fontsource-variable/* | Self-hosted variable fonts (Bricolage Grotesque, Plus Jakarta Sans, JetBrains Mono). No Google Fonts CDN dependency. |
| Node.js (22.5+) | Server runtime. Required minimum for `node:sqlite`. |
| Express 4 | HTTP routing, JSON body parsing, CORS, error middleware. Five route files mounted under `/api`. |
| node:sqlite | Node's built-in SQLite binding. No native compile, synchronous API, WAL mode enabled. |
| @google/generative-ai | Gemini SDK. Used to call `gemini-2.0-flash` for all eight prompt types. |
| youtube-transcript | Fetches public YouTube captions for the ingestion pipeline. |
| @mozilla/readability + jsdom | Extract article body text from arbitrary web pages. |
| jsonwebtoken | Signs and verifies 30-day session JWTs. |
| Resend | HTTP-API email delivery for magic links. Optional — falls back to console logging in dev. |
| dotenv | Loads `.env` at server startup. |
| concurrently | Root-level npm script that runs the server and client side-by-side during development. |

---

## 6. Interview Talking Points

A grouped list of anticipated questions with the shape of an answer you can give. Treat these as the spine of an answer, not a script.

**"Walk me through the auth flow from email to session."** A user enters an email on the login page. The server validates the email, generates a 32-byte hex token, inserts a row into `magic_links` with a 15-minute expiry, and either emails the link via Resend or logs it to the console in dev. The user clicks the link, which lands on `/auth/callback?token=...`. The client posts the token to `/api/auth/verify`. The server runs an atomic `UPDATE magic_links SET used_at = now() WHERE token = ? AND used_at IS NULL AND expires_at > now()` — only one click can succeed, even with two tabs racing. If the first-ever user is being created, every pre-auth orphaned source is claimed onto them. The server upserts the user row, signs a 30-day JWT, and returns it. The client stores the JWT in localStorage, and every subsequent request goes out with `Authorization: Bearer <jwt>`. The `requireAuth` middleware verifies the JWT, loads the user, decrypts the stored Gemini key, and attaches both to the request before any route handler runs.

**"Why magic links over passwords?"** Three reasons. First, there is no password to leak — the user cannot reuse a weak password across services because there is no password. Second, the maintenance surface is smaller: no password-reset flow, no hash-rotation policy, no breach-response runbook. Third, the user experience is actually better — sign-in is one click from the email instead of a username plus password plus optional 2FA. The trade-off is email reliance: if the user's inbox is broken, sign-in is broken. For a tool with this surface area, that trade is worth taking.

**"How do you prevent one user's burst from rate-limiting another?"** The naive answer is one global queue. That would be wrong, because Gemini's 15-requests-per-minute limit is per API key, and each user supplies their own. So the queue is keyed on the API key itself: a `Map<apiKey, RateQueue>`. Each queue has its own sliding-window timestamp list and its own Promise tail-chain. Two users with two separate keys are doing completely independent work; one user with three parallel generations is correctly serialised down to the configured cap.

**"Why SQLite instead of Postgres?"** Lumen runs on the user's machine, not in a multi-tenant cloud. Standing up Postgres for a single-instance tool would be ceremony. The original spec called for `better-sqlite3`, which is a great library but requires a C++ build — and on Node 24 prebuilt binaries are still spotty, and Windows users without Visual Studio Build Tools fail to install it. Switching to `node:sqlite` removed the native build entirely while keeping the same synchronous API. WAL mode handles the concurrency this project actually has, which is one process with multiple in-flight requests. If Lumen ever became a hosted SaaS, the data layer would move to Postgres — but every prepared statement and every query is plain SQL, so the migration is a port, not a rewrite.

**"Why no TypeScript?"** The codebase is around two thousand server lines and twenty-one client files. At that scale the iteration speed of plain JavaScript outweighed the type-safety gain, especially since the API contract is validated at the server boundary anyway. The decision is not permanent — the moment the codebase grows past what one engineer can keep in their head, TypeScript becomes the right call. I would start with a strict-mode `tsconfig` on the server, port `services/` first because that is where the type signatures pay off the most, and then move the client over file-by-file with `allowJs` enabled.

**"How would you scale this to multi-tenant SaaS?"** The architecture is most of the way there already. Users are first-class with magic-link auth, every row of user content is scoped on `user_email`, and the Gemini key is per-user and encrypted. Three remaining changes would do most of the work. First, swap SQLite for Postgres — every query is parameterised plain SQL, so it is a port not a rewrite. Second, move the per-key rate queue out of process and into Redis so it survives a deploy and works across multiple Express instances. Third, wire the dormant `oauth_accounts` table to the existing `google_client_id` and `google_client_secret` environment variables to add Google OAuth alongside magic links. After that, the remaining work is operational — health checks, structured logging, observability, and an actual deploy target.

**"What is the biggest gap in this project right now?"** Tests. There are none. The project has been iterating fast and the trade-off has been worth it for v0, but it cannot stay this way. The first tests I would write are unit tests on `server/services/ingestion.js` because URL parsing and HTML entity decoding have edge cases that catch real bugs. Second, an integration test against a temporary SQLite file that exercises the magic-link round trip end-to-end — generate, consume, JWT-verify, run a protected route. Third, a single Playwright happy-path that creates a source, generates learning, asks a question, and stars the answer.

**"Talk me through one request end-to-end."** See Section 4 above — the "Generate learning" walkthrough hits every interesting layer in the codebase in roughly two paragraphs.

**"What was the hardest decision in this project?"** Probably the pivot from a single shared Gemini key to per-user encrypted BYOK. The shared-key version was simpler and worked fine when the project was single-tenant. Moving to BYOK forced four changes at once: a real auth layer to identify the user, an encryption story for the key at rest, a per-key rate queue so users do not throttle each other, and a `MISSING_GEMINI_KEY` error path that the UI knows how to handle. Each piece was small in isolation but they had to land together — the encryption is pointless without auth, and the auth is pointless without the per-user data scoping that BYOK demands.

---

## 7. Quick Orientation Map

For future sessions in this codebase, here are the files that matter most, grouped by concern.

**Auth.** `server/routes/auth.js` (login, verify, me, logout, BYOK key endpoints). `server/services/auth.js` (AES-256-GCM helpers, JWT sign/verify, magic-link token generator, Resend email sender). `server/middleware/requireAuth.js` (Bearer parsing, JWT verify, key decryption). `client/src/hooks/useAuth.jsx` (`AuthProvider` and `useAuth` with `status: 'loading' | 'authed' | 'anon'`). `client/src/pages/LoginPage.jsx` and `client/src/pages/AuthCallbackPage.jsx`.

**Ingestion.** `server/services/ingestion.js` (YouTube, article, text branches plus the `IngestionError` class).

**Gemini.** `server/services/gemini.js` (`runGemini`, `RateQueue`, `cleanError`, prompt cache). `server/prompts/*.txt` (eight editable prompt templates).

**Database.** `server/services/db.js` (eight `CREATE TABLE` statements, around thirty prepared statements, inline `ALTER TABLE` migrations, helper functions like `claimUnownedSources`, `consumeMagicLink`).

**Routes.** `server/routes/sources.js`, `server/routes/learning.js`, `server/routes/repurpose.js`, `server/routes/chat.js`, `server/routes/auth.js`. All mounted under `/api` in `server/index.js`.

**Client pages.** `client/src/pages/HomePage.jsx`, `LibraryPage.jsx`, `NewSourcePage.jsx`, `SourcePage.jsx` (the largest by far — orchestrates Learning, Repurpose, and Chat modes), `LoginPage.jsx`, `AuthCallbackPage.jsx`, `SettingsPage.jsx`.

**Client transport.** `client/src/api.js` (the `request` wrapper, `tokenStore`, and the domain-grouped `api` object).

**Design system.** `client/src/styles/index.css` (CSS variable design tokens, dark-mode overrides, keyframes, reduced-motion gates, `clamp()` typography). `client/src/components/` (the ten hand-built primitives).

**Configuration.** `package.json` at the root (orchestration scripts). `.env.example` (every required environment variable with comments). `client/vite.config.js` (dev proxy, port assignment).
