import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Atmosphere from '../components/Atmosphere.jsx';

export default function LoginPage() {
  const { status, providers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get('error');
    if (err) setError(err);
  }, [location.search]);

  useEffect(() => {
    if (status === 'authed') navigate('/library', { replace: true });
  }, [status, navigate]);

  function startGoogle() {
    window.location.href = '/api/auth/google';
  }

  return (
    <main className="flex-1 min-h-screen relative overflow-hidden flex items-center justify-center px-6">
      <Atmosphere variant="hero" />

      <div className="relative z-[1] w-full max-w-[420px]">
        <div className="font-display font-bold text-[44px] tracking-[-0.04em] leading-none mb-10 text-ink fvs-display-lg">
          L
        </div>

        <h1 className="font-display font-medium text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.025em] text-ink mb-4 fvs-display-lg">
          Sign in to Lumen.
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-9 max-w-[40ch]">
          Lumen is bring-your-own-key — sign in, paste your Gemini key once,
          and your library lives in your account.
        </p>

        {error && (
          <div className="text-accent text-sm mb-5 border border-line bg-sunken rounded-sm px-4 py-3">
            {error}
          </div>
        )}

        {providers.google ? (
          <button
            type="button"
            onClick={startGoogle}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-medium rounded-sm bg-surface text-ink border border-line-strong hover:border-ink transition-colors duration-100"
          >
            <GoogleG />
            Continue with Google
          </button>
        ) : (
          <div className="text-muted text-sm border border-line bg-sunken rounded-sm px-4 py-3">
            Google sign-in isn't configured on this server. Set
            <code className="font-mono text-xs mx-1 px-1 py-0.5 bg-canvas rounded">GOOGLE_CLIENT_ID</code>
            and
            <code className="font-mono text-xs mx-1 px-1 py-0.5 bg-canvas rounded">GOOGLE_CLIENT_SECRET</code>
            in <code className="font-mono text-xs">.env</code> and restart.
          </div>
        )}

        <p className="text-subtle text-xs mt-8 leading-relaxed max-w-[40ch]">
          We only see your email and name. No data leaves this server — your
          Gemini key is encrypted at rest and used only for your own
          generation requests.
        </p>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
