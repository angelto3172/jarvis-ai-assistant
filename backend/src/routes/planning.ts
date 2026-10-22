import { Router } from 'express';
import { db } from '../db';
import { weeklyGoals } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createTimeBlock, getWeekEvents } from '../services/calendar.service';

const router = Router();

function getMondayStr(offset = 0): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// GET /api/planning/goals?weekOffset=0
router.get('/goals', async (req, res) => {
  const offset = parseInt(req.query.weekOffset as string ?? '0');
  const weekStart = getMondayStr(offset);
  try {
    const rows = await db.select().from(weeklyGoals).where(eq(weeklyGoals.weekStart, weekStart)).limit(1);
    res.json({ success: true, data: rows[0] ?? { weekStart, goal1: null, goal2: null, goal3: null } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/planning/goals
router.post('/goals', async (req, res) => {
  const { weekStart, goal1, goal2, goal3 } = req.body;
  if (!weekStart) return res.status(400).json({ success: false, error: 'weekStart required' });
  try {
    const existing = await db.select().from(weeklyGoals).where(eq(weeklyGoals.weekStart, weekStart)).limit(1);
    let row;
    if (existing.length > 0) {
      const updated = await db
        .update(weeklyGoals)
        .set({ goal1: goal1 ?? null, goal2: goal2 ?? null, goal3: goal3 ?? null, updatedAt: new Date() })
        .where(eq(weeklyGoals.weekStart, weekStart))
        .returning();
      row = updated[0];
    } else {
      const inserted = await db
        .insert(weeklyGoals)
        .values({ weekStart, goal1: goal1 ?? null, goal2: goal2 ?? null, goal3: goal3 ?? null })
        .returning();
      row = inserted[0];
    }
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/planning/timeblock — push a time block to Google Calendar
router.post('/timeblock', async (req, res) => {
  try {
    const { title, description, startTime, endTime, category } = req.body;
    const event = await createTimeBlock({ title, description, startTime, endTime, category });
    res.json({ success: true, data: event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/planning/week — full week calendar view
router.get('/week', async (req, res) => {
  try {
    const weekStartParam = req.query.weekStart as string;
    const weekStart = weekStartParam ? new Date(weekStartParam) : (() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const m = new Date(now);
      m.setDate(diff);
      m.setHours(0, 0, 0, 0);
      return m;
    })();
    const events = await getWeekEvents(weekStart);
    res.json({ success: true, data: events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
