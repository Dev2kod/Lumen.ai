import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, EnvelopeSimple, Check } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth.jsx';
import Atmosphere from '../components/Atmosphere.jsx';

export default function LoginPage() {
  const { status, requestMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null); // { email, delivery } once link issued

  useEffect(() => {
    if (status === 'authed') {
      const params = new URLSearchParams(location.search);
      const next = params.get('next') || '/library';
      navigate(next, { replace: true });
    }
  }, [status, location.search, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestMagicLink(email.trim().toLowerCase());
      setSent({ email: res.email, delivery: res.delivery });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSent(null);
    setEmail('');
    setError(null);
  }

  return (
    <main className="flex-1 min-h-screen relative overflow-hidden flex items-center justify-center px-6">
      <Atmosphere variant="hero" />

      <div className="relative z-[1] w-full max-w-[420px]">
        <div className="font-display font-bold text-[44px] tracking-[-0.04em] leading-none mb-10 text-ink fvs-display-lg">
          L
        </div>

        {sent ? (
          <SentState
            email={sent.email}
            delivery={sent.delivery}
            onReset={reset}
          />
        ) : (
          <SignInForm
            email={email}
            onEmailChange={setEmail}
            onSubmit={handleSubmit}
            busy={busy}
            error={error}
          />
        )}
      </div>
    </main>
  );
}

function SignInForm({ email, onEmailChange, onSubmit, busy, error }) {
  return (
    <>
      <h1 className="font-display font-medium text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.025em] text-ink mb-4 fvs-display-lg">
        Sign in to Lumen.
      </h1>
      <p className="text-muted text-[15px] leading-relaxed mb-9 max-w-[40ch]">
        Drop your email and we'll send a one-click sign-in link. No password
        to remember. Bring-your-own-key for everything else.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="block text-xs font-medium tracking-[0.04em] text-muted uppercase">
          Email
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            className="mt-2 w-full bg-surface border border-line rounded-sm px-3.5 py-3 text-sm text-ink transition-[border-color] duration-100 focus:outline-none focus:border-ink"
          />
        </label>

        {error && (
          <div className="text-accent text-sm border border-line bg-sunken rounded-sm px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!email.trim() || busy}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-sm bg-accent text-accent-on border border-accent enabled:hover:bg-accent-hover enabled:hover:border-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,border-color] duration-100"
        >
          {busy ? 'Sending…' : 'Email me a sign-in link'}
          {!busy && <ArrowRight size={14} weight="regular" />}
        </button>
      </form>

      <p className="text-subtle text-xs mt-8 leading-relaxed max-w-[40ch]">
        Your Gemini key is encrypted at rest and used only for your own
        generation requests. We don't store passwords.
      </p>
    </>
  );
}

function SentState({ email, delivery, onReset }) {
  return (
    <>
      <h1 className="font-display font-medium text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.025em] text-ink mb-4 fvs-display-lg">
        Check your inbox.
      </h1>
      <p className="text-muted text-[15px] leading-relaxed mb-7 max-w-[40ch]">
        We sent a sign-in link to{' '}
        <span className="text-ink font-medium">{email}</span>. Click it to
        finish signing in. The link expires in 15 minutes.
      </p>

      <div className="flex items-center gap-3 border border-line bg-sunken rounded-sm px-4 py-3 mb-6">
        <EnvelopeSimple size={18} weight="regular" className="text-accent shrink-0" />
        <p className="text-sm text-ink leading-snug">
          Didn't get it? Check spam, or{' '}
          <button
            type="button"
            onClick={onReset}
            className="underline decoration-line-strong underline-offset-2 hover:text-accent hover:decoration-accent"
          >
            try a different address
          </button>
          .
        </p>
      </div>

      {delivery === 'console' && (
        <div className="border border-dashed border-line rounded-sm px-4 py-3 mb-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-subtle font-medium mb-2">
            <Check size={12} weight="bold" />
            Dev mode
          </div>
          <p className="text-muted text-[13px] leading-relaxed">
            <code className="font-mono text-xs">RESEND_API_KEY</code> isn't
            set, so the magic link was printed to the server's terminal
            instead. Copy it from there and paste into your browser.
          </p>
        </div>
      )}
    </>
  );
}
