import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';

const TYPE_LABEL = {
  youtube: 'YouTube',
  article: 'Article',
  text: 'Text',
};

const EYEBROW_BASE =
  'font-sans text-[11px] tracking-[0.12em] uppercase text-subtle font-medium';

function formatDate(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LibraryPage() {
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listSources()
      .then(setSources)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="text-accent text-sm py-3">{error}</div>;
  }

  if (sources === null) {
    return <LibrarySkeleton />;
  }

  if (sources.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="font-display italic text-[32px] font-normal">Library</h1>
        <Link
          to="/new"
          className="inline-flex items-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm bg-surface text-ink border border-line-strong hover:border-ink no-underline"
        >
          <Plus size={14} weight="regular" />
          New
        </Link>
      </div>

      <div className="flex flex-col border-t border-line">
        {sources.map((s) => (
          <LibraryRow key={s.id} source={s} />
        ))}
      </div>
    </div>
  );
}

function LibraryRow({ source: s }) {
  const wordCount = s.word_count || 0;
  const readMin = Math.max(1, Math.round(wordCount / 200));
  const summaryPeek = excerptFromSummary(s.summary_excerpt);

  const meta = [];
  if (s.has_learning) meta.push('5 cards');
  if (s.repurpose_count > 0) {
    meta.push(`${s.repurpose_count} ${s.repurpose_count === 1 ? 'draft' : 'drafts'}`);
  }
  if (s.chat_count > 0) {
    const label = s.chat_count === 1 ? 'question' : 'questions';
    meta.push(
      s.starred_chat_count > 0
        ? `${s.chat_count} ${label} · ${s.starred_chat_count} saved`
        : `${s.chat_count} ${label}`
    );
  }

  return (
    <Link
      to={`/source/${s.id}`}
      className="group block py-7 border-b border-line text-left w-full no-underline text-inherit transition-[background-color] duration-100 hover:bg-sunken relative"
    >
      <div className={`mb-3 flex flex-wrap items-center ${EYEBROW_BASE}`}>
        {TYPE_LABEL[s.type]}
        <span className="mx-2.5 text-line-strong" aria-hidden="true">·</span>
        {formatDate(s.created_at)}
        {wordCount > 0 && (
          <>
            <span className="mx-2.5 text-line-strong" aria-hidden="true">·</span>
            {wordCount.toLocaleString()} words
            <span className="mx-2.5 text-line-strong" aria-hidden="true">·</span>
            {readMin} min
          </>
        )}
      </div>

      <div className="font-display text-[26px] font-medium tracking-[-0.015em] leading-[1.18] mb-3.5 text-ink max-w-[28ch] transition-colors duration-100 group-hover:text-accent fvs-display-md">
        {s.title}
      </div>

      {summaryPeek && (
        <div className="text-muted text-[15px] leading-relaxed max-w-[64ch] line-clamp-2 mb-3.5">
          {summaryPeek}
        </div>
      )}

      {meta.length > 0 && (
        <div className={`text-subtle ${EYEBROW_BASE}`} style={{ letterSpacing: '0.14em' }}>
          {meta.join('  ·  ')}
        </div>
      )}
    </Link>
  );
}

function excerptFromSummary(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/^[-•]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 180) return cleaned;
  return cleaned.slice(0, 180).replace(/\s+\S*$/, '') + '…';
}

function LibrarySkeleton() {
  const rowWidths = ['68%', '54%', '76%'];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-10">
        <Skeleton width={160} height={32} radius={2} />
        <Skeleton width={88} height={36} radius={4} />
      </div>
      <div className="flex flex-col border-t border-line">
        {rowWidths.map((w, i) => (
          <div
            key={i}
            className="block py-7 border-b border-line"
            style={{ pointerEvents: 'none' }}
          >
            <Skeleton
              width={130}
              height={11}
              style={{ display: 'block', marginBottom: 10 }}
            />
            <Skeleton width={w} height={22} style={{ display: 'block' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
