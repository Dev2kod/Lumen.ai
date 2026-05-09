import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Trash, ArrowSquareOut } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../api.js';
import Button from '../components/Button.jsx';

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.setKey(key.trim());
      await refresh();
      setKey('');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm('Remove your Gemini key? Generation will stop working until you add one again.')) return;
    setBusy(true);
    setError(null);
    try {
      await api.removeKey();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-[620px]">
      <h1 className="font-display italic text-[32px] font-normal mb-10">Settings</h1>

      <Section title="Account">
        <Row label="Signed in as">
          <div className="flex items-center gap-3">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <div className="text-ink text-sm font-medium">{user.name || user.email}</div>
              <div className="text-subtle text-xs">{user.email}</div>
            </div>
          </div>
        </Row>
        <Row label="Session">
          <Button variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </Row>
      </Section>

      <Section title="Gemini API key">
        <p className="text-muted text-sm leading-relaxed mb-5 max-w-[56ch]">
          Lumen uses your own Gemini key for every request. It's stored
          encrypted at rest and never leaves this server except to call
          Google's API on your behalf.{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent hover:decoration-accent inline-flex items-center gap-1"
          >
            Get a key
            <ArrowSquareOut size={12} weight="regular" />
          </a>
        </p>

        {user.has_gemini_key ? (
          <div className="flex items-center justify-between gap-4 border border-line rounded-sm px-4 py-3 mb-4 bg-surface">
            <div className="flex items-center gap-2.5 text-sm text-ink">
              <Check size={16} weight="bold" className="text-accent" />
              Key on file
              <span className="text-subtle font-mono text-xs">••••••••</span>
            </div>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors duration-100 disabled:opacity-40"
              aria-label="Remove key"
            >
              <Trash size={13} weight="regular" />
              Remove
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted border border-line border-dashed rounded-sm px-4 py-3 mb-4">
            No key on file. Add one below to start generating.
          </div>
        )}

        <form onSubmit={save}>
          <label
            htmlFor="key"
            className="block text-xs font-medium tracking-[0.04em] text-muted mb-2 uppercase"
          >
            {user.has_gemini_key ? 'Replace key' : 'Add key'}
          </label>
          <div className="flex gap-2">
            <input
              id="key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza…"
              className="flex-1 bg-surface border border-line rounded-sm px-3.5 py-[11px] text-sm font-mono text-ink transition-[border-color] duration-100 focus:outline-none focus:border-ink"
              disabled={busy}
            />
            <Button
              variant="primary"
              type="submit"
              loading={busy}
              disabled={!key.trim() || busy}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {savedFlash && (
            <p className="text-accent text-sm mt-3 inline-flex items-center gap-1.5">
              <Check size={14} weight="bold" />
              Saved.
            </p>
          )}
          {error && <div className="text-accent text-sm mt-3">{error}</div>}
        </form>
      </Section>

      <p className="text-subtle text-xs mt-12">
        <Link to="/library" className="hover:text-ink transition-colors duration-100">
          ← Back to library
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-12 pb-10 border-b border-line last:border-b-0">
      <h2 className="font-display italic text-[20px] font-medium mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0 border-b border-line/50 last:border-b-0">
      <div className="text-xs uppercase tracking-[0.12em] text-subtle font-medium">{label}</div>
      <div>{children}</div>
    </div>
  );
}
