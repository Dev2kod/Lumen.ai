const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ---------- Encryption (AES-256-GCM) ----------
// Used for storing each user's Gemini API key at rest.

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

// ---------- JWT ----------
const JWT_TTL = '30d';

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || '';
}

function signToken(payload) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET (or ENCRYPTION_KEY fallback) is not set in .env');
  }
  return jwt.sign(payload, secret, { expiresIn: JWT_TTL });
}

function verifyToken(token) {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ---------- Magic links ----------

const MAGIC_LINK_TTL_MIN = 15;

function newMagicToken() {
  // 32 bytes = 256 bits of entropy. Hex for URL safety.
  return crypto.randomBytes(32).toString('hex');
}

function magicLinkExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + MAGIC_LINK_TTL_MIN);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function buildMagicLinkUrl(token) {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return `${origin}/auth/callback?token=${encodeURIComponent(token)}`;
}

// ---------- Email sending ----------
// Uses Resend's HTTP API directly (no SDK dep). Falls back to console
// logging when RESEND_API_KEY is missing — useful for local dev so you
// can iterate without setting up an email service.

async function sendMagicLinkEmail({ email, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Lumen <onboarding@resend.dev>';

  if (!apiKey) {
    console.log('\n──────────────────────────────────────────────');
    console.log('  [auth] RESEND_API_KEY not set — printing magic link instead');
    console.log(`         email:  ${email}`);
    console.log(`         link:   ${link}`);
    console.log('──────────────────────────────────────────────\n');
    return { delivered: 'console' };
  }

  const subject = 'Sign in to Lumen';
  const text =
    `Click this link to sign in to Lumen:\n\n${link}\n\n` +
    `This link expires in ${MAGIC_LINK_TTL_MIN} minutes and can only be used once. ` +
    `If you didn't request it, you can safely ignore this email.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0c0f17;">
      <div style="font-family: Georgia, serif; font-size: 28px; font-weight: 500; letter-spacing: -0.02em; margin-bottom: 32px;">L</div>
      <h1 style="font-size: 22px; font-weight: 500; letter-spacing: -0.01em; margin: 0 0 16px;">Sign in to Lumen</h1>
      <p style="color: #56606e; line-height: 1.55; margin: 0 0 28px;">
        Click the button below to finish signing in. This link expires in ${MAGIC_LINK_TTL_MIN} minutes.
      </p>
      <p style="margin: 0 0 28px;">
        <a href="${link}" style="display: inline-block; background: #1e40af; color: #fff8f1; text-decoration: none; font-size: 14px; font-weight: 500; padding: 11px 20px; border-radius: 4px;">Sign in to Lumen</a>
      </p>
      <p style="color: #8c95a3; font-size: 12px; line-height: 1.5; margin: 0;">
        Didn't request this? You can safely ignore the email — your account stays untouched. The link won't work for anyone else.
      </p>
    </div>
  `;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    let parsed = null;
    try { parsed = JSON.parse(detail); } catch { /* not json */ }

    // Resend's "testing mode" 403 — you can only send to the email
    // registered on your Resend account until you verify a domain.
    // Surface a friendly message and a code the client can branch on.
    if (
      r.status === 403 &&
      parsed?.name === 'validation_error' &&
      /testing emails/i.test(parsed?.message || '')
    ) {
      const e = new Error(
        "Resend is in testing mode — until you verify a domain at resend.com/domains, magic links can only go to the email registered on your Resend account."
      );
      e.status = 503;
      e.code = 'EMAIL_TESTING_MODE';
      throw e;
    }

    // Anything else: log the detail server-side, hide it from the client.
    console.error('[auth] Resend error:', r.status, detail);
    const e = new Error(
      "Couldn't send the sign-in email. Try again in a moment."
    );
    e.status = 502;
    e.code = 'EMAIL_SEND_FAILED';
    throw e;
  }
  return { delivered: 'resend' };
}

module.exports = {
  // encryption
  encryptSecret,
  decryptSecret,
  // jwt
  signToken,
  verifyToken,
  // helpers
  isValidEmail,
  normalizeEmail,
  // magic links
  MAGIC_LINK_TTL_MIN,
  newMagicToken,
  magicLinkExpiry,
  buildMagicLinkUrl,
  sendMagicLinkEmail,
};
