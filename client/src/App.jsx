import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { House, Plus, Sun, Moon, Gear } from '@phosphor-icons/react';

import HomePage from './pages/HomePage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import NewSourcePage from './pages/NewSourcePage.jsx';
import SourcePage from './pages/SourcePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AuthCallbackPage from './pages/AuthCallbackPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { PaperPlane } from './components/Illustration.jsx';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';

const SIDEBAR_LINK_BASE =
  'flex items-center justify-center w-8 h-8 rounded-sm transition-[background-color,color] duration-100 no-underline';

function NarrowPage({ children }) {
  return (
    <main className="flex-1 w-full max-w-[920px] mx-auto px-8 pt-14 pb-32">
      {children}
    </main>
  );
}

function sidebarClass({ isActive }) {
  return isActive
    ? `${SIDEBAR_LINK_BASE} text-accent bg-accent-soft`
    : `${SIDEBAR_LINK_BASE} text-muted hover:text-ink hover:bg-sunken`;
}

const THEME_STORAGE_KEY = 'lumen.theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ThemeToggle({ theme, onToggle }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={`${SIDEBAR_LINK_BASE} text-muted hover:text-ink hover:bg-sunken bg-transparent`}
      onClick={onToggle}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
    >
      {theme === 'dark'
        ? <Sun size={18} weight="regular" />
        : <Moon size={18} weight="regular" />}
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const [theme, setTheme] = useState(getInitialTheme);
  const { status } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Auth-page paths render full-bleed, no sidebar
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname.startsWith('/auth/');

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-subtle text-sm">
        Loading…
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/library"
            element={<Protected><NarrowPage><LibraryPage /></NarrowPage></Protected>}
          />
          <Route
            path="/new"
            element={<Protected><NarrowPage><NewSourcePage /></NarrowPage></Protected>}
          />
          <Route
            path="/source/:id"
            element={<Protected><SourcePage /></Protected>}
          />
          <Route
            path="/settings"
            element={<Protected><NarrowPage><SettingsPage /></NarrowPage></Protected>}
          />
          <Route path="*" element={<NarrowPage><NotFound /></NarrowPage>} />
        </Routes>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;
  if (status === 'anon') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function Sidebar({ theme, onToggleTheme }) {
  const { user, status } = useAuth();
  return (
    <aside
      className="w-14 shrink-0 border-r border-line flex flex-col items-center pt-[18px] pb-4 bg-canvas sticky top-0 h-screen z-10"
      aria-label="Lumen navigation"
    >
      <Link
        to="/"
        title="Lumen"
        className="flex items-center justify-center w-8 h-8 mb-7 font-display text-[26px] font-bold tracking-[-0.04em] text-ink hover:text-accent no-underline fvs-display-lg"
      >
        <span aria-hidden="true">L</span>
        <span className="sr-only">Lumen home</span>
      </Link>

      {status === 'authed' && (
        <nav className="flex flex-col gap-1">
          <NavLink to="/library" className={sidebarClass} title="Library">
            <House size={18} weight="regular" />
          </NavLink>
          <NavLink to="/new" className={sidebarClass} title="New source">
            <Plus size={18} weight="regular" />
          </NavLink>
          <NavLink to="/settings" className={sidebarClass} title="Settings">
            <Gear size={18} weight="regular" />
          </NavLink>
        </nav>
      )}

      <div className="mt-auto flex flex-col items-center gap-3.5">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        {status === 'authed' && user?.avatar_url ? (
          <Link
            to="/settings"
            className={`${SIDEBAR_LINK_BASE} hover:bg-sunken p-0`}
            title={user.name || user.email}
          >
            <img
              src={user.avatar_url}
              alt=""
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          </Link>
        ) : status === 'authed' ? (
          <Link
            to="/settings"
            className={`${SIDEBAR_LINK_BASE} text-muted hover:text-ink hover:bg-sunken`}
            title={user?.name || user?.email || 'Account'}
          >
            <Gear size={18} weight="regular" />
          </Link>
        ) : (
          <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-subtle">
            v0
          </span>
        )}
      </div>
    </aside>
  );
}

function NotFound() {
  return (
    <div className="py-20 max-w-[520px]">
      <div className="flex justify-start mb-7">
        <PaperPlane size={200} />
      </div>
      <h2 className="font-display italic font-normal text-[38px] mb-4">Lost.</h2>
      <p className="text-muted text-base leading-relaxed mb-8">
        That page doesn't exist. Head back to your library.
      </p>
      <Link
        to="/library"
        className="inline-flex items-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm bg-surface text-ink border border-line-strong hover:border-ink no-underline"
      >
        Back to library
      </Link>
    </div>
  );
}
