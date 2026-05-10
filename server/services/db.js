const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'db.sqlite');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('youtube', 'article', 'text')),
    url TEXT,
    title TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    flashcard_topics TEXT,
    repurpose_angles TEXT,
    user_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  ) STRICT;

  CREATE TABLE IF NOT EXISTS learning_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    summary TEXT,
    flashcards TEXT,
    quiz TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS repurposes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('linkedin', 'twitter')),
    content TEXT NOT NULL,
    angle TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    starred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    gemini_key_ciphertext TEXT,
    gemini_key_iv TEXT,
    gemini_key_tag TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (provider, provider_user_id),
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS magic_links (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  ) STRICT;
`);

// Migrations on existing tables
const chatCols = db.prepare('PRAGMA table_info(chats)').all().map((c) => c.name);
if (!chatCols.includes('starred')) {
  db.exec('ALTER TABLE chats ADD COLUMN starred INTEGER NOT NULL DEFAULT 0');
}

const repurposeCols = db
  .prepare('PRAGMA table_info(repurposes)')
  .all()
  .map((c) => c.name);
if (!repurposeCols.includes('angle')) {
  db.exec('ALTER TABLE repurposes ADD COLUMN angle TEXT');
}

const sourceCols = db
  .prepare('PRAGMA table_info(sources)')
  .all()
  .map((c) => c.name);
if (!sourceCols.includes('flashcard_topics')) {
  db.exec('ALTER TABLE sources ADD COLUMN flashcard_topics TEXT');
}
if (!sourceCols.includes('repurpose_angles')) {
  db.exec('ALTER TABLE sources ADD COLUMN repurpose_angles TEXT');
}
if (!sourceCols.includes('user_email')) {
  db.exec('ALTER TABLE sources ADD COLUMN user_email TEXT');
}

const stmts = {
  // ---------- Users ----------
  upsertUser: db.prepare(
    `INSERT INTO users (email, name, avatar_url) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = COALESCE(excluded.name, users.name),
       avatar_url = COALESCE(excluded.avatar_url, users.avatar_url)`
  ),
  getUser: db.prepare(
    `SELECT email, name, avatar_url, gemini_key_ciphertext, gemini_key_iv, gemini_key_tag, created_at FROM users WHERE email = ?`
  ),
  setUserGeminiKey: db.prepare(
    `UPDATE users SET gemini_key_ciphertext = ?, gemini_key_iv = ?, gemini_key_tag = ? WHERE email = ?`
  ),
  countUsers: db.prepare(`SELECT COUNT(*) AS n FROM users`),

  // ---------- Sessions ----------
  insertSession: db.prepare(
    `INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)`
  ),
  getSession: db.prepare(
    `SELECT s.token, s.email, s.expires_at, u.name, u.avatar_url
     FROM sessions s
     JOIN users u ON u.email = s.email
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  ),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  cleanupExpiredSessions: db.prepare(
    `DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')`
  ),

  // ---------- OAuth links (kept for forward-compat with future Google flow) ----------
  upsertOAuthAccount: db.prepare(
    `INSERT INTO oauth_accounts (provider, provider_user_id, email) VALUES (?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET email = excluded.email`
  ),
  getOAuthAccount: db.prepare(
    `SELECT email FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?`
  ),

  // ---------- Magic links ----------
  insertMagicLink: db.prepare(
    `INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)`
  ),
  getMagicLink: db.prepare(
    `SELECT token, email, expires_at, used_at FROM magic_links WHERE token = ?`
  ),
  consumeMagicLink: db.prepare(
    `UPDATE magic_links SET used_at = datetime('now')
     WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
  ),
  cleanupOldMagicLinks: db.prepare(
    `DELETE FROM magic_links
     WHERE datetime(expires_at) < datetime('now', '-1 day')
        OR (used_at IS NOT NULL AND datetime(used_at) < datetime('now', '-1 day'))`
  ),

  // ---------- Sources (user-scoped) ----------
  insertSource: db.prepare(
    `INSERT INTO sources (type, url, title, raw_content, user_email) VALUES (?, ?, ?, ?, ?)`
  ),
  listSourcesForUser: db.prepare(
    `SELECT
       s.id,
       s.type,
       s.url,
       s.title,
       s.created_at,
       (LENGTH(s.raw_content) - LENGTH(REPLACE(s.raw_content, ' ', ''))) AS word_count,
       (SELECT summary FROM learning_artifacts
         WHERE source_id = s.id
         ORDER BY datetime(generated_at) DESC LIMIT 1) AS summary_excerpt,
       (SELECT 1 FROM learning_artifacts WHERE source_id = s.id LIMIT 1) AS has_learning,
       (SELECT COUNT(*) FROM chats WHERE source_id = s.id) AS chat_count,
       (SELECT COUNT(*) FROM chats WHERE source_id = s.id AND starred = 1) AS starred_chat_count,
       (SELECT COUNT(DISTINCT format) FROM repurposes WHERE source_id = s.id) AS repurpose_count
     FROM sources s
     WHERE s.user_email = ?
     ORDER BY datetime(s.created_at) DESC, s.id DESC`
  ),
  getSourceForUser: db.prepare(
    `SELECT id, type, url, title, raw_content, flashcard_topics, repurpose_angles, user_email, created_at
     FROM sources WHERE id = ? AND user_email = ?`
  ),
  setFlashcardTopics: db.prepare(
    `UPDATE sources SET flashcard_topics = ? WHERE id = ?`
  ),
  setRepurposeAngles: db.prepare(
    `UPDATE sources SET repurpose_angles = ? WHERE id = ?`
  ),
  deleteSourceForUser: db.prepare(
    `DELETE FROM sources WHERE id = ? AND user_email = ?`
  ),

  getLatestLearning: db.prepare(
    `SELECT id, source_id, summary, flashcards, quiz, generated_at
     FROM learning_artifacts
     WHERE source_id = ?
     ORDER BY datetime(generated_at) DESC, id DESC
     LIMIT 1`
  ),
  insertLearning: db.prepare(
    `INSERT INTO learning_artifacts (source_id, summary, flashcards, quiz) VALUES (?, ?, ?, ?)`
  ),

  listRepurposes: db.prepare(
    `SELECT id, source_id, format, content, angle, generated_at
     FROM repurposes WHERE source_id = ?
     ORDER BY datetime(generated_at) DESC, id DESC`
  ),
  insertRepurpose: db.prepare(
    `INSERT INTO repurposes (source_id, format, content, angle) VALUES (?, ?, ?, ?)`
  ),

  listChats: db.prepare(
    `SELECT id, source_id, question, answer, starred, created_at
     FROM chats WHERE source_id = ?
     ORDER BY datetime(created_at) ASC, id ASC`
  ),
  insertChat: db.prepare(
    `INSERT INTO chats (source_id, question, answer) VALUES (?, ?, ?)`
  ),
  getChatById: db.prepare(
    `SELECT id, source_id, question, answer, starred, created_at FROM chats WHERE id = ?`
  ),
  setChatStarred: db.prepare(
    `UPDATE chats SET starred = ? WHERE id = ?`
  ),
  deleteChatRow: db.prepare(`DELETE FROM chats WHERE id = ?`),

  updateFlashcardsOnLearning: db.prepare(
    `UPDATE learning_artifacts SET flashcards = ? WHERE id = ?`
  ),

  // First-user-claims-all: bulk-assign every NULL-user_email row to the
  // given email. Called once when the very first user signs in so any
  // pre-auth sources don't become orphaned.
  claimUnownedSources: db.prepare(
    `UPDATE sources SET user_email = ? WHERE user_email IS NULL`
  ),
};

function toNum(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}

// ---------- Users ----------
function upsertUser({ email, name, avatar_url }) {
  stmts.upsertUser.run(email, name ?? null, avatar_url ?? null);
  return stmts.getUser.get(email);
}

function getUser(email) {
  return stmts.getUser.get(email);
}

function setUserGeminiKey(email, encrypted) {
  if (!encrypted) {
    stmts.setUserGeminiKey.run(null, null, null, email);
  } else {
    stmts.setUserGeminiKey.run(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      email
    );
  }
}

function countUsers() {
  return stmts.countUsers.get().n;
}

function claimUnownedSources(email) {
  return stmts.claimUnownedSources.run(email).changes;
}

// ---------- Sessions ----------
function insertSession({ token, email, expires_at }) {
  stmts.insertSession.run(token, email, expires_at);
}

function getSession(token) {
  return stmts.getSession.get(token);
}

function deleteSession(token) {
  stmts.deleteSession.run(token);
}

function cleanupExpiredSessions() {
  return stmts.cleanupExpiredSessions.run().changes;
}

// ---------- OAuth ----------
function upsertOAuthAccount({ provider, provider_user_id, email }) {
  stmts.upsertOAuthAccount.run(provider, provider_user_id, email);
}

function getOAuthAccount({ provider, provider_user_id }) {
  return stmts.getOAuthAccount.get(provider, provider_user_id);
}

// ---------- Magic links ----------
function insertMagicLink({ token, email, expires_at }) {
  stmts.insertMagicLink.run(token, email, expires_at);
}

function getMagicLink(token) {
  return stmts.getMagicLink.get(token);
}

/**
 * Atomically marks the link consumed if it's still valid.
 * Returns true on success (caller can trust the email + sign the user in),
 * false if the link is already used, expired, or doesn't exist.
 */
function consumeMagicLink(token) {
  return stmts.consumeMagicLink.run(token).changes > 0;
}

function cleanupOldMagicLinks() {
  return stmts.cleanupOldMagicLinks.run().changes;
}

// ---------- Sources ----------
function listSources(email) {
  return stmts.listSourcesForUser.all(email);
}

function getSourceById(id, email) {
  const row = stmts.getSourceForUser.get(id, email);
  if (!row) return null;
  return {
    ...row,
    flashcard_topics: row.flashcard_topics
      ? JSON.parse(row.flashcard_topics)
      : null,
    repurpose_angles: row.repurpose_angles
      ? JSON.parse(row.repurpose_angles)
      : null,
  };
}

function setFlashcardTopics(id, topics) {
  stmts.setFlashcardTopics.run(
    topics && Array.isArray(topics) ? JSON.stringify(topics) : null,
    id
  );
}

function setRepurposeAngles(id, angles) {
  stmts.setRepurposeAngles.run(
    angles && Array.isArray(angles) ? JSON.stringify(angles) : null,
    id
  );
}

function insertSource({ type, url, title, raw_content, user_email }) {
  const info = stmts.insertSource.run(
    type,
    url ?? null,
    title,
    raw_content,
    user_email
  );
  return getSourceById(toNum(info.lastInsertRowid), user_email);
}

function deleteSource(id, email) {
  return stmts.deleteSourceForUser.run(id, email).changes > 0;
}

function parseFlashcards(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { topic: 'Overview', cards: parsed };
  return parsed;
}

function getLatestLearning(sourceId) {
  const row = stmts.getLatestLearning.get(sourceId);
  if (!row) return null;
  return {
    ...row,
    flashcards: parseFlashcards(row.flashcards),
    quiz: row.quiz ? JSON.parse(row.quiz) : null,
  };
}

function insertLearning({ source_id, summary, flashcards, quiz }) {
  stmts.insertLearning.run(
    source_id,
    summary ?? null,
    flashcards ? JSON.stringify(flashcards) : null,
    quiz ? JSON.stringify(quiz) : null
  );
  return getLatestLearning(source_id);
}

function listRepurposes(sourceId) {
  return stmts.listRepurposes.all(sourceId);
}

function insertRepurpose({ source_id, format, content, angle }) {
  const info = stmts.insertRepurpose.run(
    source_id,
    format,
    content,
    angle ?? null
  );
  const newId = toNum(info.lastInsertRowid);
  return stmts.listRepurposes.all(source_id).find((r) => r.id === newId);
}

function listChats(sourceId) {
  return stmts.listChats.all(sourceId);
}

function insertChat({ source_id, question, answer }) {
  const info = stmts.insertChat.run(source_id, question, answer);
  return stmts.getChatById.get(toNum(info.lastInsertRowid));
}

function getChatById(id) {
  return stmts.getChatById.get(id);
}

function setChatStarred(id, starred) {
  stmts.setChatStarred.run(starred ? 1 : 0, id);
  return getChatById(id);
}

function deleteChat(id) {
  return stmts.deleteChatRow.run(id).changes > 0;
}

function updateLatestFlashcards(sourceId, flashcards) {
  const latest = stmts.getLatestLearning.get(sourceId);
  if (!latest) return null;
  stmts.updateFlashcardsOnLearning.run(JSON.stringify(flashcards), latest.id);
  return getLatestLearning(sourceId);
}

module.exports = {
  db,
  // user
  upsertUser,
  getUser,
  setUserGeminiKey,
  countUsers,
  claimUnownedSources,
  // session
  insertSession,
  getSession,
  deleteSession,
  cleanupExpiredSessions,
  // oauth
  upsertOAuthAccount,
  getOAuthAccount,
  // magic links
  insertMagicLink,
  getMagicLink,
  consumeMagicLink,
  cleanupOldMagicLinks,
  // sources
  listSources,
  getSourceById,
  insertSource,
  deleteSource,
  getLatestLearning,
  insertLearning,
  listRepurposes,
  insertRepurpose,
  listChats,
  insertChat,
  getChatById,
  setChatStarred,
  deleteChat,
  updateLatestFlashcards,
  setFlashcardTopics,
  setRepurposeAngles,
};
