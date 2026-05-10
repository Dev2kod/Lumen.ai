require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const sourcesRouter = require('./routes/sources');
const learningRouter = require('./routes/learning');
const repurposeRouter = require('./routes/repurpose');
const chatRouter = require('./routes/chat');
const authRouter = require('./routes/auth');
const { IngestionError } = require('./services/ingestion');
const { requireAuth } = require('./middleware/requireAuth');

const PORT = Number(process.env.PORT) || 5050;

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Auth endpoints are unauthenticated by design (login + provider list);
// /me + key management read the Bearer token themselves.
app.use('/api/auth', authRouter);

// Everything below here requires a valid JWT.
app.use('/api/sources', requireAuth, sourcesRouter);
app.use('/api/sources', requireAuth, learningRouter);
app.use('/api/sources', requireAuth, repurposeRouter);
app.use('/api/sources', requireAuth, chatRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, _next) => {
  const status = err.status || (err instanceof IngestionError ? 422 : 500);
  if (status >= 500) console.error('[server]', err);
  res.status(status).json({ error: err.message || 'Server error', code: err.code });
});

app.listen(PORT, () => {
  console.log(`[lumen] api listening on http://localhost:${PORT}`);
});
