const express = require('express');
const crypto = require('crypto');

const {
  upsertUser,
  getUser,
  setUserGeminiKey,
  countUsers,
  claimUnownedSources,
  insertSession,
  getSession,
  deleteSession,
  upsertOAuthAccount,
  getOAuthAccount,
} = require('../services/db');
const {
  encryptSecret,
  newSessionToken,
  sessionExpiry,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
  googleConfigured,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
} = require('../services/auth');

const router = express.Router();

// ---------- /providers (public) ----------
// Lets the login page show only the buttons that actually work.
router.get('/providers', (req, res) => {
  res.json({ google: googleConfigured() });
});

// ---------- /me ----------
router.get('/me', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const session = getSession(token);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = getUser(session.email);
  res.json({
    user: {
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      has_gemini_key: !!user.gemini_key_ciphertext,
    },
    providers: {
      google: googleConfigured(),
    },
  });
});

// ---------- /logout ----------
router.post('/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) deleteSession(token);
  clearSessionCookie(res);
  res.status(204).end();
});

// ---------- /me/key (BYOK) ----------
router.put('/me/key', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? getSession(token) : null;
  if (!session) return res.status(401).json({ error: 'Not signed in' });

  const key = (req.body?.key || '').trim();
  if (!key) {
    setUserGeminiKey(session.email, null);
    return res.json({ has_gemini_key: false });
  }
  if (key.length < 20 || key.length > 200) {
    return res.status(400).json({ error: 'That doesn\'t look like a valid Gemini key.' });
  }

  const encrypted = encryptSecret(key);
  setUserGeminiKey(session.email, encrypted);
  res.json({ has_gemini_key: true });
});

router.delete('/me/key', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? getSession(token) : null;
  if (!session) return res.status(401).json({ error: 'Not signed in' });

  setUserGeminiKey(session.email, null);
  res.json({ has_gemini_key: false });
});

// ---------- Google OAuth ----------
const oauthStates = new Map(); // state -> { createdAt }

function newState() {
  const s = crypto.randomBytes(16).toString('hex');
  oauthStates.set(s, { createdAt: Date.now() });
  // GC anything older than 10 minutes
  for (const [k, v] of oauthStates) {
    if (Date.now() - v.createdAt > 10 * 60 * 1000) oauthStates.delete(k);
  }
  return s;
}

router.get('/google', (req, res) => {
  if (!googleConfigured()) {
    return res
      .status(503)
      .send('Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.');
  }
  const state = newState();
  res.redirect(buildGoogleAuthUrl(state));
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(failureRedirect(`Google sign-in cancelled: ${oauthError}`));
    }
    if (!code || !state) {
      return res.redirect(failureRedirect('Missing authorization code.'));
    }
    if (!oauthStates.has(state)) {
      return res.redirect(failureRedirect('OAuth state mismatch. Try signing in again.'));
    }
    oauthStates.delete(state);

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokens.access_token);

    if (!profile.email || !profile.email_verified) {
      return res.redirect(failureRedirect('Your Google account does not have a verified email.'));
    }

    // First user signing in claims any pre-auth (NULL user_email) sources.
    const wasFirst = countUsers() === 0;

    const user = upsertUser({
      email: profile.email,
      name: profile.name || null,
      avatar_url: profile.picture || null,
    });
    upsertOAuthAccount({
      provider: 'google',
      provider_user_id: profile.sub,
      email: user.email,
    });

    if (wasFirst) claimUnownedSources(user.email);

    const token = newSessionToken();
    insertSession({
      token,
      email: user.email,
      expires_at: sessionExpiry(),
    });
    setSessionCookie(res, token);

    res.redirect(successRedirect());
  } catch (err) {
    next(err);
  }
});

function clientOrigin() {
  return process.env.CLIENT_ORIGIN || 'http://localhost:5173';
}

function successRedirect() {
  return clientOrigin() + '/library';
}

function failureRedirect(message) {
  const u = new URL('/login', clientOrigin());
  u.searchParams.set('error', message);
  return u.toString();
}

module.exports = router;
