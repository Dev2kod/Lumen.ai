const { getSession, getUser } = require('../services/db');
const { decryptSecret, SESSION_COOKIE, clearSessionCookie } = require('../services/auth');

/**
 * Reads the session cookie, looks up the session + user, attaches:
 *   req.user           — { email, name, avatar_url }
 *   req.geminiKey      — decrypted Gemini API key, or null if not set
 *
 * Routes that need the key should check `req.geminiKey` and return a 400
 * with code MISSING_GEMINI_KEY if absent — the client uses that to nudge
 * the user to /settings.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Sign in to continue' });

  const session = getSession(token);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = getUser(session.email);
  if (!user) {
    clearSessionCookie(res);
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
