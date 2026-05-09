const crypto = require('crypto');

// ---------- Encryption (AES-256-GCM) ----------
// Used for storing each user's Gemini API key at rest. The encryption key is
// a 32-byte hex string in env, separate from anything Google-related, so
// rotating Google credentials doesn't lose user keys.

function getEncryptionKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" and add it to .env'
    );
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return Buffer.from(hex, 'hex');
}

function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptSecret({ ciphertext, iv, tag }) {
  if (!ciphertext || !iv || !tag) return null;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

// ---------- Sessions ----------

const SESSION_COOKIE = 'lumen_session';
const SESSION_TTL_DAYS = 30;

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// ---------- Google OAuth ----------
// Raw OAuth 2.0 authorization code flow against Google's endpoints.
// No SDK — fetch + URLSearchParams keeps the dep tree small.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function googleConfig() {
  // In dev, the redirect URI must point at the Vite origin (5173) so the
  // Set-Cookie response from the proxied callback lands on the same origin
  // the SPA runs on. Vite forwards /api → backend; the backend sets the
  // cookie, redirects to /library, browser sees it as same-origin.
  const defaultRedirect =
    (process.env.CLIENT_ORIGIN || 'http://localhost:5173') +
    '/api/auth/google/callback';
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || defaultRedirect,
  };
}

function googleConfigured() {
  const c = googleConfig();
  return !!(c.clientId && c.clientSecret);
}

function buildGoogleAuthUrl(state) {
  const c = googleConfig();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const c = googleConfig();
  const body = new URLSearchParams({
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: 'authorization_code',
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${r.status} ${detail}`);
  }
  return r.json();
}

async function fetchGoogleProfile(accessToken) {
  const r = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`Google userinfo failed: ${r.status}`);
  }
  return r.json(); // { sub, email, email_verified, name, picture, ... }
}

module.exports = {
  // encryption
  encryptSecret,
  decryptSecret,
  // sessions
  SESSION_COOKIE,
  newSessionToken,
  sessionExpiry,
  setSessionCookie,
  clearSessionCookie,
  // google
  googleConfig,
  googleConfigured,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
};
