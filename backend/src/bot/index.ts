import cron from 'node-cron';
import { db } from '../db';
import { schoolTasks, contentPosts, weeklyGoals, examAlerts } from '../db/schema';
import { eq, gte } from 'drizzle-orm';
import { getTodayEvents, getWeekEvents, isAuthorized } from '../services/calendar.service';
import { sendMorningBriefing, sendExamAlert, sendWeeklyPlanningPrompt } from '../services/telegram.service';

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function getWeekGoals(): Promise<string[]> {
  const monday = getMondayOfCurrentWeek();
  const weekStartStr = monday.toISOString().split('T')[0];
  const rows = await db.select().from(weeklyGoals).where(eq(weeklyGoals.weekStart, weekStartStr)).limit(1);
  if (!rows.length) return [];
  const row = rows[0];
  return [row.goal1, row.goal2, row.goal3].filter(Boolean) as string[];
}

export async function runMorningBriefing() {
  console.log('[Bot] Running morning briefing...');
  try {
    const [goals, calAuthorized] = await Promise.all([getWeekGoals(), isAuthorized()]);
    const events = calAuthorized ? await getTodayEvents() : [];
    await sendMorningBriefing(goals, events);
    console.log('[Bot] Morning briefing sent.');
  } catch (err) {
    console.error('[Bot] Morning briefing error:', err);
  }
}

export async function runExamAlerts() {
  console.log('[Bot] Checking exam alerts...');
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const exams = await db.select().from(schoolTasks).where(eq(schoolTasks.isExam, true));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const exam of exams) {
      if (!exam.dueDate) continue;
      const examDate = new Date(exam.dueDate);
      examDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0 || daysLeft > 7) continue;

      const existingRows = await db.select().from(examAlerts).where(eq(examAlerts.taskId, exam.id)).limit(1);

      if (existingRows.length === 0) {
        await db.insert(examAlerts).values({
          taskId: exam.id,
          examName: exam.assignment,
          examDate: exam.dueDate,
        });
      }

      const row = (await db.select().from(examAlerts).where(eq(examAlerts.taskId, exam.id)).limit(1))[0];
      if (!row) continue;

      if (daysLeft === 7 && !row.alertSent7) {
        await sendExamAlert(exam.assignment, 7, exam.dueDate);
        await db.update(examAlerts).set({ alertSent7: true }).where(eq(examAlerts.taskId, exam.id));
      } else if (daysLeft === 3 && !row.alertSent3) {
        await sendExamAlert(exam.assignment, 3, exam.dueDate);
        await db.update(examAlerts).set({ alertSent3: true }).where(eq(examAlerts.taskId, exam.id));
      } else if (daysLeft === 1 && !row.alertSent1) {
        await sendExamAlert(exam.assignment, 1, exam.dueDate);
        await db.update(examAlerts).set({ alertSent1: true }).where(eq(examAlerts.taskId, exam.id));
      }
    }
    console.log('[Bot] Exam alerts checked.');
  } catch (err) {
    console.error('[Bot] Exam alert error:', err);
  }
}

export async function runWeeklyPlanningPrompt() {
  console.log('[Bot] Sending weekly planning prompt...');
  try {
    const monday = getMondayOfCurrentWeek();
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const mondayStr = monday.toISOString().split('T')[0];
    const nextMondayStr = nextMonday.toISOString().split('T')[0];

    const [allSchool, allContent, calAuthorized] = await Promise.all([
      db.select().from(schoolTasks),
      db.select().from(contentPosts),
      isAuthorized(),
    ]);

    const upcomingAssignments = allSchool
      .filter(t => t.dueDate && t.dueDate >= mondayStr && t.dueDate < nextMondayStr && t.status !== 'done')
      .map(t => ({ name: t.assignment, dueDate: t.dueDate }));

    const upcomingPosts = allContent
      .filter(c => c.postDate && c.postDate >= mondayStr && c.postDate < nextMondayStr)
      .map(c => ({ name: c.title, postDate: c.postDate }));

    const events = calAuthorized ? await getWeekEvents(monday) : [];

    await sendWeeklyPlanningPrompt({
      assignments: upcomingAssignments,
      events,
      posts: upcomingPosts,
    });
    console.log('[Bot] Weekly planning prompt sent.');
  } catch (err) {
    console.error('[Bot] Weekly planning prompt error:', err);
  }
}

export function startBot() {
  // ── Cron jobs ──────────────────────────────────────────────
  cron.schedule('0 8 * * *', runMorningBriefing, { timezone: 'America/New_York' });
  cron.schedule('0 9 * * *', runExamAlerts, { timezone: 'America/New_York' });
  cron.schedule('0 19 * * 0', runWeeklyPlanningPrompt, { timezone: 'America/New_York' });
  console.log('[Bot] Telegram cron jobs started (briefing 8am, exam check 9am, Sunday 7pm).');

  // ── Two-way chat via Claude ─────────────────────────────────
  const { startChat } = require('./chat');
  startChat();
}
