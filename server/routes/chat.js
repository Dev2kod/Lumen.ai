const express = require('express');
const {
  getSourceById,
  insertChat,
  getChatById,
  setChatStarred,
  deleteChat,
} = require('../services/db');
const { runGemini } = require('../services/gemini');

const router = express.Router();

router.post('/:id/ask', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const question = (req.body?.question || '').trim();
    if (question.length < 2) {
      return res.status(400).json({ error: 'Please write a question.' });
    }
    if (question.length > 1000) {
      return res
        .status(400)
        .json({ error: 'Keep questions under 1000 characters.' });
    }

    const source = getSourceById(id, req.user.email);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const answer = await runGemini({
      apiKey: req.geminiKey,
      promptName: 'ask',
      content: source.raw_content,
      vars: { question },
    });

    const chat = insertChat({ source_id: id, question, answer });
    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/chats/:chatId/star', (req, res) => {
  const sourceId = Number(req.params.id);
  const chatId = Number(req.params.chatId);
  const source = getSourceById(sourceId, req.user.email);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  const chat = getChatById(chatId);
  if (!chat || chat.source_id !== sourceId) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  const next = chat.starred ? 0 : 1;
  const updated = setChatStarred(chatId, next);
  res.json({ chat: updated });
});

router.delete('/:id/chats/:chatId', (req, res) => {
  const sourceId = Number(req.params.id);
  const chatId = Number(req.params.chatId);
  const source = getSourceById(sourceId, req.user.email);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  const chat = getChatById(chatId);
  if (!chat || chat.source_id !== sourceId) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  if (chat.starred) {
    return res
      .status(409)
      .json({ error: 'Unstar this chat before deleting it.' });
  }
  deleteChat(chatId);
  res.status(204).end();
});

module.exports = router;
