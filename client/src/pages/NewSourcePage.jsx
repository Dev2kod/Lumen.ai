import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tabs from '../components/Tabs.jsx';
import Button from '../components/Button.jsx';
import { api } from '../api.js';

const TABS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'article', label: 'Article' },
  { id: 'text', label: 'Text' },
];

const HELPER = {
  youtube: 'Paste a YouTube URL. Lumen will pull the transcript and store it as a source.',
  article: 'Paste an article URL. Lumen will fetch and clean the readable text.',
  text: 'Paste any text — notes, an essay, a chat log. Lumen will use it as-is.',
};

const INPUT_CLASS =
  'w-full bg-surface border border-line rounded-sm px-3.5 py-[11px] text-sm text-ink transition-[border-color] duration-100 focus:outline-none focus:border-ink';

const TEXTAREA_CLASS = `${INPUT_CLASS} resize-y min-h-[220px] leading-relaxed`;

const FIELD_LABEL_CLASS =
  'block text-xs font-medium tracking-[0.04em] text-muted mb-2 uppercase';

export default function NewSourcePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('youtube');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload =
        tab === 'text' ? { type: 'text', text } : { type: tab, url };
      const source = await api.createSource(payload);
      navigate(`/source/${source.id}`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[620px]">
      <h1 className="font-display italic text-[32px] font-normal mb-9">Add a source</h1>

      <div className="mb-7">
        <Tabs tabs={TABS} current={tab} onChange={(id) => { setTab(id); setError(null); }} />
      </div>

      <p className="text-muted text-sm mb-6">{HELPER[tab]}</p>

      <form onSubmit={handleSubmit}>
        {tab === 'youtube' && (
          <>
            <label className={FIELD_LABEL_CLASS} htmlFor="yt">YouTube URL</label>
            <input
              id="yt"
              className={INPUT_CLASS}
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
            />
          </>
        )}
        {tab === 'article' && (
          <>
            <label className={FIELD_LABEL_CLASS} htmlFor="art">Article URL</label>
            <input
              id="art"
              className={INPUT_CLASS}
              type="url"
              placeholder="https://example.com/post/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
            />
          </>
        )}
        {tab === 'text' && (
          <>
            <label className={FIELD_LABEL_CLASS} htmlFor="txt">Text</label>
            <textarea
              id="txt"
              className={TEXTAREA_CLASS}
              placeholder="Paste your notes or an essay…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              autoFocus
            />
          </>
        )}

        {error && <div className="text-accent text-sm py-3 mt-4">{error}</div>}

        <div className="mt-6 flex gap-3 items-center">
          <Button variant="primary" type="submit" loading={loading}>
            {loading ? 'Ingesting…' : 'Ingest'}
          </Button>
          <Button variant="ghost" type="button" onClick={() => navigate('/library')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
