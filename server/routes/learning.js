const express = require('express');
const {
  getSourceById,
  insertLearning,
  updateLatestFlashcards,
  setFlashcardTopics,
  setRepurposeAngles,
} = require('../services/db');
const { runGemini } = require('../services/gemini');

const router = express.Router();

router.post('/:id/learning', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const source = getSourceById(id, req.user.email);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const apiKey = req.geminiKey;
    const content = source.raw_content;
    const topic = 'Overview';

    const summary = await runGemini({ apiKey, promptName: 'summary', content });
    const cards = await runGemini({
      apiKey,
      promptName: 'flashcards',
      content,
      vars: { topic },
      json: true,
    });
    const quiz = await runGemini({
      apiKey,
      promptName: 'quiz',
      content,
      json: true,
    });

    let flashcardTopics = null;
    let repurposeAngles = null;
    try {
      const topicsResult = await runGemini({
        apiKey,
        promptName: 'flashcard-topics',
        content,
        json: true,
      });
      flashcardTopics = Array.isArray(topicsResult?.topics)
        ? topicsResult.topics
        : null;
      if (flashcardTopics) setFlashcardTopics(id, flashcardTopics);
    } catch (e) {
      console.warn('[learning] flashcard-topics failed:', e.message);
    }
    try {
      const anglesResult = await runGemini({
        apiKey,
        promptName: 'repurpose-angles',
        content,
        json: true,
      });
      repurposeAngles = Array.isArray(anglesResult?.angles)
        ? anglesResult.angles
        : null;
      if (repurposeAngles) setRepurposeAngles(id, repurposeAngles);
    } catch (e) {
      console.warn('[learning] repurpose-angles failed:', e.message);
    }

    const artifact = insertLearning({
      source_id: id,
      summary,
      flashcards: { topic, cards },
      quiz,
    });

    const refreshedSource = getSourceById(id, req.user.email);
    res.status(201).json({ learning: artifact, source: refreshedSource });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/flashcards', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const topic =
      (req.body?.topic || 'Overview').trim().slice(0, 80) || 'Overview';
    const source = getSourceById(id, req.user.email);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const cards = await runGemini({
      apiKey: req.geminiKey,
      promptName: 'flashcards',
      content: source.raw_content,
      vars: { topic },
      json: true,
    });

    const updated = updateLatestFlashcards(id, { topic, cards });
    if (!updated) {
      return res.status(409).json({
        error: 'Generate the learning artifacts first, then switch topics.',
      });
    }
    res.status(201).json({ learning: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
