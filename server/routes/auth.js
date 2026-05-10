const express = require('express');

const {
  upsertUser,
  getUser,
  setUserGeminiKey,
  countUsers,
  claimUnownedSources,
  insertMagicLink,
  consumeMagicLink,
  getMagicLink,
  cleanupOldMagicLinks,
} = require('../services/db');
const {
  encryptSecret,
  signToken,
  verifyToken,
  isValidEmail,
  normalizeEmail,
  newMagicToken,
  magicLinkExpiry,
  buildMagicLinkUrl,
  sendMagicLinkEmail,
} = require('../services/auth');

const router = express.Router();

function readBearer(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function authedUser(req) {
  const token = readBearer(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.email) return null;
  return getUser(payload.email);
}

// ---------- POST /login ----------
// Request a magic link. Always returns the same success shape regardless
// of whether the email is registered — prevents email-enumeration probing.
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email.' });
    }

    const token = newMagicToken();
    insertMagicLink({ token, email, expires_at: magicLinkExpiry() });

    const link = buildMagicLinkUrl(token);
    const delivery = await sendMagicLinkEmail({ email, link });

    // Best-effort GC so the table doesn't grow forever in dev
    try { cleanupOldMagicLinks(); } catch { /* ignore */ }

    res.json({
      ok: true,
      email,
      // Only surface "delivered: console" to the client in dev so the UI
      // can hint that the link is in the server logs.
      delivery: delivery.delivered,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /verify ----------
// Consume a magic-link token and return a JWT. Atomic — two clicks of the
// same email link produce one usable token; the second 404s.
router.post('/verify', (req, res) => {
  const token = (req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'Missing token.' });
  }

  const row = getMagicLink(token);
  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired sign-in link.' });
  }

  const ok = consumeMagicLink(token);
  if (!ok) {
    return res.status(400).json({
      error: 'This sign-in link has already been used or expired. Request a new one.',
    });
  }

  const wasFirst = countUsers() === 0;
  const user = upsertUser({ email: row.email, name: null, avatar_url: null });
  if (wasFirst) claimUnownedSources(user.email);

  const jwt = signToken({ email: user.email });
  res.json({
    token: jwt,
    user: {
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      has_gemini_key: !!user.gemini_key_ciphertext,
    },
  });
});

// ---------- GET /me ----------
router.get('/me', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  res.json({
    user: {
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      has_gemini_key: !!user.gemini_key_ciphertext,
    },
  });
});

// ---------- POST /logout ----------
router.post('/logout', (_req, res) => {
  // Stateless tokens — nothing to invalidate server-side.
  res.status(204).end();
});

// ---------- /me/key (BYOK) ----------
router.put('/me/key', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  const key = (req.body?.key || '').trim();
  if (!key) {
    setUserGeminiKey(user.email, null);
    return res.json({ has_gemini_key: false });
  }
  if (key.length < 20 || key.length > 200) {
    return res.status(400).json({ error: "That doesn't look like a valid Gemini key." });
  }

  const encrypted = encryptSecret(key);
  setUserGeminiKey(user.email, encrypted);
  res.json({ has_gemini_key: true });
});

router.delete('/me/key', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  setUserGeminiKey(user.email, null);
  res.json({ has_gemini_key: false });
});

module.exports = router;
