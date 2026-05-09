const { YoutubeTranscript } = require('youtube-transcript');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

class IngestionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IngestionError';
    this.status = 422;
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchYouTubeTitle(url, videoId) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 LumenBot/0.1' },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    const m = html.match(/<title>([^<]+)<\/title>/i);
    if (m) {
      return m[1].replace(/\s*-\s*YouTube\s*$/, '').trim();
    }
  } catch (e) {
    console.warn(`[ingestion] could not fetch YouTube title: ${e.message}`);
  }
  return `YouTube video ${videoId}`;
}

async function ingestYouTube(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new IngestionError("That doesn't look like a valid YouTube URL.");
  }

  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (e) {
    throw new IngestionError(
      'This YouTube video has no transcript available. Try one with captions.'
    );
  }
  if (!segments || segments.length === 0) {
    throw new IngestionError(
      'This YouTube video has no transcript available. Try one with captions.'
    );
  }

  const raw_content = segments
    .map((s) => decodeHTMLEntities(s.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const title = await fetchYouTubeTitle(url, videoId);

  return { type: 'youtube', url, title, raw_content };
}

function decodeHTMLEntities(s) {
  return s
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

async function ingestArticle(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new IngestionError('Please provide a full http:// or https:// URL.');
  }
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LumenBot/0.1; +https://example.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (e) {
    throw new IngestionError(`Could not reach that URL: ${e.message}`);
  }
  if (!res.ok) {
    throw new IngestionError(
      `Fetching the article returned HTTP ${res.status}. Try pasting the text directly.`
    );
  }
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.length < 100) {
    throw new IngestionError(
      "Couldn't extract readable article text from that page. Try pasting the text directly."
    );
  }

  return {
    type: 'article',
    url,
    title: (article.title || url).trim(),
    raw_content: article.textContent.trim(),
  };
}

function ingestText(text) {
  const trimmed = (text || '').trim();
  if (trimmed.length < 30) {
    throw new IngestionError(
      'That text is too short — paste at least a paragraph.'
    );
  }
  const firstLine = trimmed.split(/\n+/)[0];
  let title = firstLine.slice(0, 60).trim();
  if (firstLine.length > 60) title += '…';
  return { type: 'text', url: null, title, raw_content: trimmed };
}

module.exports = {
  ingestYouTube,
  ingestArticle,
  ingestText,
  IngestionError,
};
