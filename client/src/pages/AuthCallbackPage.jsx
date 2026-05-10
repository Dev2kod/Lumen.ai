import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Atmosphere from '../components/Atmosphere.jsx';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const { verifyMagicLink } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // StrictMode-safe; magic tokens are one-shot
    ranRef.current = true;

    const token = params.get('token');
    if (!token) {
      setError('Missing sign-in token in the URL.');
      return;
    }

    verifyMagicLink(token)
      .then(() => navigate('/library', { replace: true }))
      .catch((e) => setError(e.message));
  }, [params, verifyMagicLink, navigate]);

  return (
    <main className="flex-1 min-h-screen relative overflow-hidden flex items-center justify-center px-6">
      <Atmosphere variant="hero" />

      <div className="relative z-[1] w-full max-w-[420px]">
        <div className="font-display font-bold text-[44px] tracking-[-0.04em] leading-none mb-10 text-ink fvs-display-lg">
          L
        </div>

        {error ? (
          <>
            <h1 className="font-display font-medium text-[clamp(26px,3.6vw,36px)] leading-[1.1] tracking-[-0.02em] text-ink mb-4 fvs-display-md">
              Sign-in link didn't work.
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-7 max-w-[40ch]">
              {error}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-sm bg-accent text-accent-on border border-accent hover:bg-accent-hover hover:border-accent-hover no-underline"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display font-medium text-[clamp(26px,3.6vw,36px)] leading-[1.1] tracking-[-0.02em] text-ink mb-4 fvs-display-md">
              Signing you in…
            </h1>
            <p className="text-muted text-[15px] leading-relaxed">
              Verifying the link from your email.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
