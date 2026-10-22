import { Router } from 'express';
import {
  getAuthUrl,
  exchangeCode,
  getTodayEvents,
  getWeekEvents,
  createTimeBlock,
  deleteEvent,
  isAuthorized,
} from '../services/calendar.service';

const router = Router();

router.get('/status', async (_req, res) => {
  const authorized = await isAuthorized();
  res.json({ authorized });
});

router.get('/auth', (_req, res) => {
  res.json({ url: getAuthUrl() });
});

// OAuth callback (mounted at /auth/callback in the main app)
router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');
  try {
    await exchangeCode(code);
    res.redirect(`${process.env.FRONTEND_URL}?calAuth=success`);
  } catch (err: any) {
    console.error('[Calendar/callback]', err.message);
    res.redirect(`${process.env.FRONTEND_URL}?calAuth=error`);
  }
});

router.get('/today', async (_req, res) => {
  try {
    const data = await getTodayEvents();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Calendar/today]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/week', async (req, res) => {
  try {
    const weekStartParam = req.query.weekStart as string;
    const weekStart = weekStartParam ? new Date(weekStartParam) : getMondayOfCurrentWeek();
    const data = await getWeekEvents(weekStart);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Calendar/week]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/block', async (req, res) => {
  try {
    const { title, description, startTime, endTime, category } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'title, startTime, endTime required' });
    }
    const event = await createTimeBlock({ title, description, startTime, endTime, category });
    res.json({ success: true, data: event });
  } catch (err: any) {
    console.error('[Calendar/block]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/event/:id', async (req, res) => {
  try {
    await deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default router;
