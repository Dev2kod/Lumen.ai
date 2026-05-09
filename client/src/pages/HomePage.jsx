import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';

import Atmosphere from '../components/Atmosphere.jsx';

const ROTATING_NOUNS = [
  'YouTube videos',
  'articles',
  'pasted notes',
  'lectures',
  'long reads',
];

const FADE_DELAYS = ['0.05s', '0.30s', '0.55s', '0.80s', '1.05s', '1.40s', '1.65s', '1.95s'];

function FadeUp({ delay = 0, className = '', as: Component = 'span', children, ...rest }) {
  return (
    <Component
      className={`opacity-0 translate-y-[14px] animate-fade-up ${className}`}
      style={{ animationDelay: FADE_DELAYS[delay] }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export default function HomePage() {
  const [nounIndex, setNounIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setNounIndex((i) => (i + 1) % ROTATING_NOUNS.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="flex-1 flex flex-col justify-center items-start w-full max-w-[920px] mx-auto px-14 pt-16 pb-12 min-h-screen relative overflow-hidden [&>*]:relative [&>*]:z-[1]">
      <Atmosphere variant="hero" />

      <FadeUp
        delay={0}
        as="div"
        aria-hidden="true"
        className="font-display font-bold text-[56px] tracking-[-0.04em] leading-none mb-16 text-ink fvs-display-lg"
      >
        L
      </FadeUp>

      <h1 className="font-display font-medium text-[clamp(36px,5.4vw,76px)] leading-[1.02] tracking-[-0.03em] text-ink mb-9 max-w-[14ch] fvs-display-lg">
        <FadeUp delay={1} as="span" className="block">Lumen turns</FadeUp>
        <FadeUp delay={2} as="span" className="block text-accent font-semibold min-h-[1.05em] fvs-display-lg">
          <span key={nounIndex} className="inline-block animate-word-in">
            {ROTATING_NOUNS[nounIndex]}
          </span>
        </FadeUp>
        <FadeUp delay={3} as="span" className="block">into things you</FadeUp>
        <FadeUp delay={4} as="span" className="block">understand &mdash; and teach.</FadeUp>
      </h1>

      <FadeUp
        delay={5}
        as="p"
        className="text-[17px] leading-relaxed text-muted max-w-[52ch] mb-10"
      >
        Drop in any source. Get a summary, flashcards, a quiz, and ready-to-post
        drafts for LinkedIn or Twitter. Ask the source anything. All local, no
        accounts.
      </FadeUp>

      <FadeUp
        delay={6}
        as="div"
        className="flex gap-3 items-center flex-wrap mb-auto pb-16"
      >
        <Link
          to="/library"
          className="inline-flex items-center justify-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm bg-accent text-accent-on border border-accent hover:bg-accent-hover hover:border-accent-hover no-underline"
        >
          Enter library
          <ArrowRight size={14} weight="regular" />
        </Link>
        <Link
          to="/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm text-muted hover:text-ink hover:bg-sunken no-underline"
        >
          Or start with a new source
        </Link>
      </FadeUp>

      <FadeUp delay={7} as="div" className="flex items-center gap-4 mt-auto">
        <span className="font-sans text-[11px] tracking-[0.12em] uppercase text-subtle font-medium">
          A learn-to-teach engine
        </span>
        <span className="w-8 h-px bg-line-strong" aria-hidden="true" />
        <span className="font-sans text-[11px] tracking-[0.12em] uppercase text-subtle font-medium">
          Lumen &nbsp;·&nbsp; v0
        </span>
      </FadeUp>
    </main>
  );
}
