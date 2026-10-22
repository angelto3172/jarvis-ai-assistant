import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import schoolRouter from './routes/school';
import contentRouter from './routes/content';
import agencyRouter from './routes/agency';
import calendarRouter from './routes/calendar';
import planningRouter from './routes/planning';
import dashboardRouter from './routes/dashboard';
import botRouter from './routes/bot';
import { startBot } from './bot';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
// Bind to this machine only by default so the unauthenticated API isn't exposed to your Wi-Fi network.
const HOST = process.env.HOST ?? '127.0.0.1';

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Google OAuth callback
app.use('/auth', calendarRouter);

// API routes
app.use('/api/school', schoolRouter);
app.use('/api/content', contentRouter);
app.use('/api/agency', agencyRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/planning', planningRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/bot', botRouter);

app.listen(PORT, HOST, () => {
  console.log(`🚀 Jarvis backend running on http://${HOST}:${PORT}`);
  startBot();
});
