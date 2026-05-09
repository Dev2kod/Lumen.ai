const express = require('express');
const {
  getSourceById,
  insertRepurpose,
  setRepurposeAngles,
} = require('../services/db');
const { runGemini } = require('../services/gemini');

const router = express.Router();

const ALLOWED = new Set(['linkedin', 'twitter']);

router.post('/:id/repurpose', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { format } = req.body || {};
    if (!ALLOWED.has(format)) {
      return res
        .status(400)
        .json({ error: 'format must be "linkedin" or "twitter"' });
    }

    const angle =
      (req.body?.angle || 'Most interesting insight').trim().slice(0, 100) ||
      'Most interesting insight';

    const source = getSourceById(id, req.user.email);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const apiKey = req.geminiKey;

    const content = await runGemini({
      apiKey,
      promptName: format,
      content: source.raw_content,
      vars: { angle },
    });

    if (!source.repurpose_angles) {
      runGemini({
        apiKey,
        promptName: 'repurpose-angles',
        content: source.raw_content,
        json: true,
      })
        .then((result) => {
          if (Array.isArray(result?.angles)) {
            setRepurposeAngles(id, result.angles);
          }
        })
        .catch((e) =>
          console.warn('[repurpose] background angle gen failed:', e.message)
        );
    }

    const row = insertRepurpose({ source_id: id, format, content, angle });
    res.status(201).json({ repurpose: row });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
