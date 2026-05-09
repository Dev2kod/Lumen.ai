const express = require('express');
const {
  listSources,
  getSourceById,
  insertSource,
  deleteSource,
  getLatestLearning,
  listRepurposes,
  listChats,
} = require('../services/db');
const {
  ingestYouTube,
  ingestArticle,
  ingestText,
} = require('../services/ingestion');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ sources: listSources(req.user.email) });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const source = getSourceById(id, req.user.email);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  res.json({
    source,
    learning: getLatestLearning(id),
    repurposes: listRepurposes(id),
    chats: listChats(id),
  });
});

router.post('/', async (req, res, next) => {
  try {
    const { type, url, text } = req.body || {};
    let payload;

    if (type === 'youtube') {
      payload = await ingestYouTube(url);
    } else if (type === 'article') {
      payload = await ingestArticle(url);
    } else if (type === 'text') {
      payload = ingestText(text);
    } else {
      return res
        .status(400)
        .json({ error: `Unknown source type "${type}".` });
    }

    const source = insertSource({ ...payload, user_email: req.user.email });
    res.status(201).json({ source });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ok = deleteSource(id, req.user.email);
  if (!ok) return res.status(404).json({ error: 'Source not found' });
  res.status(204).end();
});

module.exports = router;
