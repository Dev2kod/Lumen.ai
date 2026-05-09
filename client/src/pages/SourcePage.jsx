import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, ArrowLeft, Star, TrashSimple } from '@phosphor-icons/react';

import { api } from '../api.js';
import Tabs from '../components/Tabs.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Flashcard from '../components/Flashcard.jsx';
import QuizQuestion from '../components/QuizQuestion.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Atmosphere from '../components/Atmosphere.jsx';
import { Spark } from '../components/Illustration.jsx';

const TYPE_LABEL = { youtube: 'YouTube', article: 'Article', text: 'Text' };

const LEARNING_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'ask', label: 'Ask' },
];

const REPURPOSE_TABS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'Twitter' },
];

const EYEBROW_BASE =
  'font-sans text-[11px] tracking-[0.12em] uppercase text-subtle font-medium';

const COVER_CTA_BASE =
  'group/cta inline-flex items-center gap-2 self-start bg-transparent border-0 p-0 font-sans text-[11px] tracking-[0.16em] uppercase font-semibold cursor-pointer no-underline transition-[color,gap] duration-100 hover:gap-3';

const PANE_TITLE = 'font-display italic text-[22px] font-medium tracking-[-0.005em]';

const HELPER_TEXT = 'text-muted text-sm';

const ERROR_TEXT = 'text-accent text-sm py-3';

const TOPIC_CHIP_BASE =
  'bg-surface border rounded-sm px-3 py-[7px] text-[13px] font-medium cursor-pointer transition-[border-color,background-color,color] duration-100 disabled:cursor-not-allowed';

const ICON_BTN =
  'w-[30px] h-[30px] p-0 rounded-sm border border-transparent bg-transparent text-muted inline-flex items-center justify-center transition-[color,background-color,border-color] duration-100 hover:text-ink hover:bg-sunken disabled:opacity-30 disabled:cursor-not-allowed';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SourcePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState('learning');
  const [learningTab, setLearningTab] = useState('summary');
  const [repurposeTab, setRepurposeTab] = useState('linkedin');

  useEffect(() => {
    setData(null);
    api.getSource(id).then(setData).catch((e) => setLoadError(e.message));
  }, [id]);

  if (loadError) {
    return (
      <main className="flex-1 w-full max-w-[920px] mx-auto px-8 pt-14 pb-32">
        <div className={ERROR_TEXT}>{loadError}</div>
      </main>
    );
  }
  if (!data) return <SourcePageSkeleton />;

  const { source, learning, repurposes, chats } = data;
  const flashcardTopics = source?.flashcard_topics || null;
  const repurposeAngles = source?.repurpose_angles || null;

  async function handleDelete() {
    if (!confirm('Delete this source and all its generated content?')) return;
    await api.deleteSource(source.id);
    navigate('/library');
  }

  return (
    <main className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,8fr)_minmax(0,12fr)] min-h-screen">
      <aside className="relative md:sticky md:top-0 md:self-start md:min-h-screen flex flex-col px-7 py-9 md:px-[clamp(28px,3.5vw,52px)] border-b md:border-b-0 md:border-r border-line bg-sunken overflow-hidden">
        <Atmosphere variant="cover" />

        <div className="shrink-0 relative z-[1]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 font-sans text-[13px] font-medium text-muted hover:text-ink transition-colors duration-100 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={14} weight="regular" />
            Library
          </button>
        </div>

        <div className="flex flex-col mt-14 min-w-0 relative z-[1]">
          <div className={`mb-3.5 ${EYEBROW_BASE}`}>
            {TYPE_LABEL[source.type]} &nbsp;·&nbsp; {formatDate(source.created_at)}
          </div>

          <h1 className="font-display text-[clamp(28px,3.2vw,44px)] font-medium leading-[1.08] tracking-[-0.02em] text-ink mb-6 max-w-[18ch] [hyphens:auto] break-words fvs-display-md">
            {source.title}
          </h1>

          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={`${COVER_CTA_BASE} text-ink hover:text-accent border-b-0`}
            >
              View original
              <ArrowRight size={12} weight="regular" />
            </a>
          )}

          <nav
            className="flex flex-col mt-10 border-t border-line pt-[18px]"
            role="tablist"
            aria-label="Source modes"
          >
            <ModeItem
              active={mode === 'learning'}
              onClick={() => setMode('learning')}
              label="Learning"
            />
            <ModeItem
              active={mode === 'repurpose'}
              onClick={() => setMode('repurpose')}
              label="Repurpose"
            />
          </nav>
        </div>

        <div className="shrink-0 mt-auto pt-16 flex flex-col items-start gap-5 relative z-[1]">
          <button
            type="button"
            className={`${COVER_CTA_BASE} text-muted hover:text-accent`}
            onClick={handleDelete}
          >
            Delete source
            <ArrowRight size={12} weight="regular" />
          </button>
          {(() => {
            const wc = (source.raw_content || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean).length;
            const min = Math.max(1, Math.round(wc / 200));
            return (
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-subtle">
                {wc.toLocaleString()} words &nbsp;·&nbsp; {min} min read
              </div>
            );
          })()}
        </div>
      </aside>

      <section className="px-7 pt-10 pb-24 md:px-[clamp(32px,4vw,64px)] min-w-0 overflow-x-hidden">
        {mode === 'learning' && (
          <LearningView
            sourceId={source.id}
            initial={learning}
            chats={chats || []}
            flashcardTopics={flashcardTopics}
            tab={learningTab}
            onTabChange={setLearningTab}
            onUpdate={(updated, updatedSource) =>
              setData((d) => ({
                ...d,
                learning: updated,
                source: updatedSource ?? d.source,
              }))
            }
            onChat={(chat) =>
              setData((d) => ({ ...d, chats: [...(d.chats || []), chat] }))
            }
            onChatUpdate={(updated) =>
              setData((d) => ({
                ...d,
                chats: (d.chats || []).map((c) =>
                  c.id === updated.id ? updated : c
                ),
              }))
            }
            onChatDelete={(chatId) =>
              setData((d) => ({
                ...d,
                chats: (d.chats || []).filter((c) => c.id !== chatId),
              }))
            }
          />
        )}

        {mode === 'repurpose' && (
          <RepurposeView
            sourceId={source.id}
            existing={repurposes}
            angles={repurposeAngles}
            tab={repurposeTab}
            onTabChange={setRepurposeTab}
            onAppend={(row) =>
              setData((d) => ({ ...d, repurposes: [row, ...d.repurposes] }))
            }
          />
        )}
      </section>
    </main>
  );
}

function ModeItem({ active, onClick, label }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`group flex items-center gap-3.5 py-2.5 bg-transparent border-0 font-sans text-[15px] font-medium cursor-pointer text-left transition-colors duration-100 ${
        active ? 'text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-[background-color,transform] duration-100 ${
          active
            ? 'bg-accent scale-150'
            : 'bg-subtle group-hover:bg-ink'
        }`}
      />
      {label}
    </button>
  );
}

function SourcePageSkeleton() {
  return (
    <main className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,8fr)_minmax(0,12fr)] min-h-screen">
      <aside className="relative md:sticky md:top-0 md:self-start md:min-h-screen flex flex-col px-7 py-9 md:px-[clamp(28px,3.5vw,52px)] border-b md:border-b-0 md:border-r border-line bg-sunken overflow-hidden">
        <Atmosphere variant="cover" />
        <div className="shrink-0 relative z-[1]">
          <Skeleton width={64} height={14} />
        </div>

        <div className="flex flex-col mt-14 min-w-0 relative z-[1]">
          <Skeleton width={180} height={11} style={{ display: 'block', marginBottom: 14 }} />
          <Skeleton width="92%" height={36} style={{ display: 'block', marginBottom: 8 }} />
          <Skeleton width="78%" height={36} style={{ display: 'block', marginBottom: 24 }} />
          <Skeleton width={120} height={11} />

          <div className="flex flex-col mt-10 pt-[18px]">
            <div className="flex items-center gap-3.5 py-2.5" style={{ pointerEvents: 'none' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
              <Skeleton width={70} height={13} />
            </div>
            <div className="flex items-center gap-3.5 py-2.5" style={{ pointerEvents: 'none' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
              <Skeleton width={88} height={13} />
            </div>
          </div>
        </div>

        <div className="shrink-0 mt-auto pt-16 flex flex-col items-start gap-5 relative z-[1]">
          <Skeleton width={120} height={11} />
          <Skeleton width={88} height={9} />
        </div>
      </aside>

      <section className="px-7 pt-10 pb-24 md:px-[clamp(32px,4vw,64px)] min-w-0 overflow-x-hidden">
        <div className="flex gap-7 pb-3 border-b border-line">
          <Skeleton width={56} height={14} />
          <Skeleton width={76} height={14} />
          <Skeleton width={40} height={14} />
          <Skeleton width={36} height={14} />
        </div>
        <div className="mt-9">
          <Skeleton width="100%" height={14} style={{ display: 'block', marginBottom: 10 }} />
          <Skeleton width="94%" height={14} style={{ display: 'block', marginBottom: 10 }} />
          <Skeleton width="88%" height={14} style={{ display: 'block', marginBottom: 10 }} />
          <Skeleton width="55%" height={14} style={{ display: 'block', marginBottom: 24 }} />
          <Skeleton width="100%" height={14} style={{ display: 'block', marginBottom: 10 }} />
          <Skeleton width="82%" height={14} style={{ display: 'block' }} />
        </div>
      </section>
    </main>
  );
}

function LearningView({
  sourceId,
  initial,
  chats,
  flashcardTopics,
  tab,
  onTabChange,
  onUpdate,
  onChat,
  onChatUpdate,
  onChatDelete,
}) {
  const [learning, setLearning] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.generateLearning(sourceId);
      setLearning(result.learning);
      onUpdate(result.learning, result.source);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function applyLearningUpdate(next) {
    setLearning(next);
    onUpdate(next);
  }

  if (!learning && tab !== 'ask') {
    return (
      <div>
        <Tabs tabs={LEARNING_TABS} current={tab} onChange={onTabChange} />
        <div className="mt-8 animate-tab-fade" key={tab}>
          <div className="pt-8 pb-16 text-left max-w-[480px]">
            <div className="flex justify-start mb-4">
              <Spark size={104} />
            </div>
            <h2 className={`${PANE_TITLE} mb-3`}>Learning</h2>
            <p className={`${HELPER_TEXT} leading-relaxed mb-6`}>
              Generate a summary, five flashcards, and a five-question quiz from
              this source. You can also jump to <strong>Ask</strong> to query
              the source directly.
            </p>
            <Button variant="primary" onClick={generate} loading={busy}>
              {busy ? 'Generating…' : 'Generate learning'}
            </Button>
            {error && <div className={`${ERROR_TEXT} mt-4`}>{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Tabs tabs={LEARNING_TABS} current={tab} onChange={onTabChange} />

      <div className="mt-8 animate-tab-fade" key={tab}>
        {tab === 'summary' && (
          learning?.summary ? (
            <div className="markdown">
              <ReactMarkdown>{learning.summary}</ReactMarkdown>
            </div>
          ) : (
            <p className={HELPER_TEXT}>No summary yet.</p>
          )
        )}

        {tab === 'flashcards' && (
          <FlashcardsTab
            sourceId={sourceId}
            learning={learning}
            topics={flashcardTopics}
            onUpdate={applyLearningUpdate}
          />
        )}

        {tab === 'quiz' && (
          <div>
            {(learning?.quiz || []).map((q, i) => (
              <QuizQuestion key={i} question={q} index={i} />
            ))}
          </div>
        )}

        {tab === 'ask' && (
          <AskView
            sourceId={sourceId}
            chats={chats}
            onChat={onChat}
            onChatUpdate={onChatUpdate}
            onChatDelete={onChatDelete}
          />
        )}
      </div>

      {tab !== 'ask' && learning && (
        <div className="mt-14 pt-8 border-t border-line">
          <Button variant="secondary" onClick={generate} loading={busy}>
            {busy ? 'Regenerating…' : 'Regenerate all'}
          </Button>
          {error && <div className={`${ERROR_TEXT} mt-4`}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function AskView({ sourceId, chats, onChat, onChatUpdate, onChatDelete }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [rowError, setRowError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const chat = await api.askQuestion(sourceId, q);
      onChat(chat);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  }

  async function handleStar(chat) {
    setRowError(null);
    try {
      const updated = await api.toggleStarChat(sourceId, chat.id);
      onChatUpdate(updated);
    } catch (e) {
      setRowError(e.message);
    }
  }

  async function handleDelete(chat) {
    if (chat.starred) return;
    if (!confirm('Delete this chat?')) return;
    setRowError(null);
    try {
      await api.deleteChat(sourceId, chat.id);
      onChatDelete(chat.id);
    } catch (e) {
      setRowError(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-7">
        {chats.length === 0 ? (
          <p className={`${HELPER_TEXT} py-4`}>
            Ask anything about this source — the model has the full content as
            context.
          </p>
        ) : (
          chats.map((c) => (
            <div
              key={c.id}
              className={`group/turn flex flex-col gap-3.5 pb-7 border-b border-line last:border-b-0 last:pb-0 ${
                c.starred ? 'is-starred' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="font-display italic text-[19px] leading-snug text-ink relative pl-[18px] flex-1 min-w-0 before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-2 before:h-px before:bg-accent">
                  {c.question}
                </div>
                <div
                  className={`flex gap-1 shrink-0 transition-opacity duration-100 ${
                    c.starred
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/turn:opacity-100 group-focus-within/turn:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    className={`${ICON_BTN} ${
                      c.starred ? 'text-accent hover:text-accent-hover hover:bg-accent-soft' : ''
                    }`}
                    onClick={() => handleStar(c)}
                    title={c.starred ? 'Unstar' : 'Star this chat'}
                    aria-label={c.starred ? 'Unstar chat' : 'Star chat'}
                  >
                    <Star size={14} weight={c.starred ? 'fill' : 'regular'} />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BTN} hover:text-accent`}
                    onClick={() => handleDelete(c)}
                    disabled={!!c.starred}
                    title={c.starred ? 'Unstar to delete' : 'Delete chat'}
                    aria-label="Delete chat"
                  >
                    <TrashSimple size={14} weight="regular" />
                  </button>
                </div>
              </div>
              <div className="markdown">
                <ReactMarkdown>{c.answer}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex flex-col gap-3.5 pb-7 border-b border-line">
            <div className="font-display italic text-[19px] leading-snug text-ink relative pl-[18px] before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-2 before:h-px before:bg-accent">
              {question.trim() || '…'}
            </div>
            <div className="inline-flex items-center gap-2.5 text-muted text-sm pl-[18px]">
              <Spinner /> <span>Thinking…</span>
            </div>
          </div>
        )}
        {rowError && <div className={ERROR_TEXT}>{rowError}</div>}
      </div>

      <form
        className="flex flex-col gap-3 pt-6 border-t border-line"
        onSubmit={handleSubmit}
      >
        <textarea
          className="w-full bg-surface border border-line rounded-sm px-3.5 py-3 text-sm leading-snug text-ink resize-y min-h-[76px] font-sans transition-[border-color] duration-100 focus:outline-none focus:border-ink disabled:bg-sunken disabled:cursor-not-allowed"
          placeholder="Ask a question…  (⌘/Ctrl + Enter to send)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={busy}
        />
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            disabled={!question.trim() || busy}
          >
            {busy ? 'Asking…' : 'Ask'}
          </Button>
          {error && <div className={ERROR_TEXT}>{error}</div>}
        </div>
      </form>
    </div>
  );
}

function FlashcardsTab({ sourceId, learning, topics, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [busyTopic, setBusyTopic] = useState(null);
  const [error, setError] = useState(null);
  const [customTopic, setCustomTopic] = useState('');

  const currentTopic = learning?.flashcards?.topic || 'Overview';
  const cards = learning?.flashcards?.cards || [];

  const hasTopics = Array.isArray(topics) && topics.length > 0;
  const chipTopics = hasTopics
    ? Array.from(new Set(['Overview', currentTopic, ...topics].filter(Boolean)))
    : null;

  async function regenerate(topic) {
    if (busy) return;
    setBusy(true);
    setBusyTopic(topic);
    setError(null);
    try {
      const updated = await api.regenerateFlashcards(sourceId, topic);
      onUpdate(updated);
      setCustomTopic('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setBusyTopic(null);
    }
  }

  async function handleCustomSubmit(e) {
    e.preventDefault();
    const t = customTopic.trim();
    if (!t || busy) return;
    await regenerate(t);
  }

  return (
    <div className="flex flex-col gap-8">
      {chipTopics && (
        <TopicPrompter
          eyebrow="Choose a focus"
          chips={chipTopics}
          current={currentTopic}
          busyChip={busyTopic}
          busy={busy}
          onPick={regenerate}
          customValue={customTopic}
          onCustomChange={setCustomTopic}
          onCustomSubmit={handleCustomSubmit}
          customPlaceholder="Or type a custom focus…"
          customMaxLength={60}
          error={error}
        />
      )}

      <div className="text-sm text-ink">
        <span className={HELPER_TEXT}>Currently focused on </span>
        <strong className="font-semibold text-ink">{currentTopic}</strong>
        {cards.length > 0 && (
          <span className={HELPER_TEXT}> · {cards.length} cards</span>
        )}
      </div>

      <p className={`${HELPER_TEXT} -mt-4`}>Click a card to flip it.</p>
      <div className="flex flex-col gap-3 -mt-4">
        {cards.map((c, i) => (
          <Flashcard key={`${currentTopic}-${i}`} card={c} index={i} />
        ))}
      </div>
    </div>
  );
}

function TopicPrompter({
  eyebrow,
  chips,
  current,
  busyChip,
  busy,
  onPick,
  customValue,
  onCustomChange,
  onCustomSubmit,
  customPlaceholder,
  customMaxLength,
  error,
}) {
  return (
    <div className="flex flex-col gap-3.5 pb-6 border-b border-line">
      <div className={`mb-1 ${EYEBROW_BASE}`}>{eyebrow}</div>
      <div className="flex flex-wrap gap-2 items-center">
        {chips.map((t) => {
          const isActive = t === current;
          const isBusy = busyChip === t;
          return (
            <button
              key={t}
              type="button"
              className={`${TOPIC_CHIP_BASE} ${
                isActive
                  ? 'border-accent bg-accent-soft text-accent cursor-default'
                  : 'border-line text-muted hover:border-ink hover:text-ink'
              } ${isBusy ? 'opacity-60' : ''}`}
              onClick={() => onPick(t)}
              disabled={busy}
            >
              {t}
            </button>
          );
        })}
      </div>

      <form onSubmit={onCustomSubmit} className="flex gap-2 items-stretch">
        <input
          className="flex-1 bg-surface border border-line rounded-sm px-3.5 py-[11px] text-sm text-ink transition-[border-color] duration-100 focus:outline-none focus:border-ink"
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder={customPlaceholder}
          maxLength={customMaxLength}
          disabled={busy}
        />
        <Button
          variant="secondary"
          type="submit"
          loading={busy && !!customValue.trim()}
          disabled={!customValue.trim() || busy}
        >
          Generate
        </Button>
      </form>
      {error && <div className={ERROR_TEXT}>{error}</div>}
    </div>
  );
}

function RepurposeView({ sourceId, existing, angles, tab, onTabChange, onAppend }) {
  const linkedin = existing.find((r) => r.format === 'linkedin');
  const twitter = existing.find((r) => r.format === 'twitter');

  return (
    <div>
      <Tabs tabs={REPURPOSE_TABS} current={tab} onChange={onTabChange} />

      <div className="mt-8 animate-tab-fade" key={tab}>
        {tab === 'linkedin' && (
          <RepurposeArtifact
            title="LinkedIn post"
            helper="A medium-length, idea-led post for LinkedIn."
            format="linkedin"
            sourceId={sourceId}
            existing={linkedin}
            angles={angles}
            onAppend={onAppend}
          />
        )}
        {tab === 'twitter' && (
          <RepurposeArtifact
            title="Twitter thread"
            helper="A 6–8 tweet thread, hook first."
            format="twitter"
            sourceId={sourceId}
            existing={twitter}
            angles={angles}
            onAppend={onAppend}
          />
        )}
      </div>
    </div>
  );
}

function RepurposeArtifact({
  title,
  helper,
  format,
  sourceId,
  existing,
  angles,
  onAppend,
}) {
  const [busy, setBusy] = useState(false);
  const [busyAngle, setBusyAngle] = useState(null);
  const [error, setError] = useState(null);
  const [content, setContent] = useState(existing?.content || null);
  const [currentAngle, setCurrentAngle] = useState(
    existing?.angle || 'Most interesting insight'
  );
  const [customAngle, setCustomAngle] = useState('');

  async function regenerate(angle) {
    if (busy) return;
    setBusy(true);
    setBusyAngle(angle);
    setError(null);
    try {
      const row = await api.generateRepurpose(sourceId, format, angle);
      setContent(row.content);
      setCurrentAngle(row.angle || angle);
      onAppend(row);
      setCustomAngle('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setBusyAngle(null);
    }
  }

  async function handleCustomSubmit(e) {
    e.preventDefault();
    const a = customAngle.trim();
    if (!a || busy) return;
    await regenerate(a);
  }

  const hasAngles = Array.isArray(angles) && angles.length > 0;
  const chipAngles = hasAngles
    ? Array.from(
        new Set(
          ['Most interesting insight', currentAngle, ...angles].filter(Boolean)
        )
      )
    : null;

  return (
    <div>
      {chipAngles && (
        <TopicPrompter
          eyebrow="Choose an angle"
          chips={chipAngles}
          current={currentAngle}
          busyChip={busyAngle}
          busy={busy}
          onPick={regenerate}
          customValue={customAngle}
          onCustomChange={setCustomAngle}
          onCustomSubmit={handleCustomSubmit}
          customPlaceholder="Or type a custom angle…"
          customMaxLength={100}
          error={error}
        />
      )}

      {!content ? (
        <div className="pt-8 pb-16 text-left max-w-[480px]">
          <div className="flex justify-start mb-4">
            <Spark size={88} />
          </div>
          <h2 className={`${PANE_TITLE} mb-3`}>{title}</h2>
          <p className={`${HELPER_TEXT} leading-relaxed mb-6`}>
            {helper}
            {chipAngles
              ? ' Pick an angle above to generate.'
              : ' Generate the Learning artifacts first to unlock angle suggestions, or click Generate below to use the default angle.'}
          </p>
          {!chipAngles && (
            <Button
              variant="primary"
              onClick={() => regenerate('Most interesting insight')}
              loading={busy}
            >
              {busy ? 'Generating…' : 'Generate'}
            </Button>
          )}
          {!chipAngles && error && (
            <div className={`${ERROR_TEXT} mt-4`}>{error}</div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <div className="text-sm text-ink mb-4">
            <span className={HELPER_TEXT}>Angled as </span>
            <strong className="font-semibold text-ink">{currentAngle}</strong>
          </div>

          <div className="flex items-baseline justify-between mb-5">
            <h2 className={PANE_TITLE}>{title}</h2>
            <CopyButton text={content} />
          </div>
          <div className="bg-sunken border border-line rounded-sm px-[22px] py-5 font-mono text-[13px] leading-[1.7] whitespace-pre-wrap text-ink">
            {content}
          </div>
          <div className="mt-14 pt-8 border-t border-line">
            <Button
              variant="secondary"
              onClick={() => regenerate(currentAngle)}
              loading={busy && !customAngle.trim()}
            >
              {busy ? 'Regenerating…' : 'Regenerate same angle'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
