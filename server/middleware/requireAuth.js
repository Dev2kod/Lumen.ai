const { getUser } = require('../services/db');
const { decryptSecret, verifyToken } = require('../services/auth');

/**
 * Reads `Authorization: Bearer <jwt>`, verifies, looks up the user, attaches:
 *   req.user      — { email, name, avatar_url }
 *   req.geminiKey — decrypted Gemini API key, or null if not set
 *
 * Routes that need the key check `req.geminiKey` and return 400 with
 * code MISSING_GEMINI_KEY if absent — the client uses that to nudge the
 * user to /settings.
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in to continue' });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue' });
  }

  const payload = verifyToken(token);
  if (!payload?.email) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = getUser(payload.email);
  if (!user) {
    return res.status(401).json({ error: 'Account not found' });
  }

  req.user = {
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  };

  if (
    user.gemini_key_ciphertext &&
    user.gemini_key_iv &&
    user.gemini_key_tag
  ) {
    try {
      req.geminiKey = decryptSecret({
        ciphertext: user.gemini_key_ciphertext,
        iv: user.gemini_key_iv,
        tag: user.gemini_key_tag,
      });
    } catch (e) {
      console.warn('[auth] failed to decrypt Gemini key for', user.email, e.message);
      req.geminiKey = null;
    }
  } else {
    req.geminiKey = null;
  }

  next();
}

module.exports = { requireAuth };
