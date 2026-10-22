import { Router } from 'express';
import { db } from '../db';
import { schoolTasks, contentPosts, agencyProjects, weeklyGoals } from '../db/schema';
import { eq, gte, lte, and } from 'drizzle-orm';
import { getTodayEvents, isAuthorized } from '../services/calendar.service';

const router = Router();

function getMondayStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getSundayStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(now);
  sunday.setDate(diff);
  sunday.setHours(23, 59, 59, 0);
  return sunday.toISOString().split('T')[0];
}

router.get('/', async (_req, res) => {
  try {
    const weekStart = getMondayStr();
    const weekEnd = getSundayStr();
    const todayStr = new Date().toISOString().split('T')[0];
    const calAuthorized = await isAuthorized();

    const [allSchool, allContent, allAgency, goalsRows, calEvents] = await Promise.allSettled([
      db.select().from(schoolTasks),
      db.select().from(contentPosts),
      db.select().from(agencyProjects),
      db.select().from(weeklyGoals).where(eq(weeklyGoals.weekStart, weekStart)).limit(1),
      calAuthorized ? getTodayEvents() : Promise.resolve([]),
    ]);

    const school = allSchool.status === 'fulfilled' ? allSchool.value : [];
    const content = allContent.status === 'fulfilled' ? allContent.value : [];
    const agency = allAgency.status === 'fulfilled' ? allAgency.value : [];
    const goals = goalsRows.status === 'fulfilled' ? goalsRows.value : [];
    const events = calEvents.status === 'fulfilled' ? calEvents.value : [];

    // Assignments due this week (not exams, not done)
    const dueSoon = school.filter(t => {
      if (!t.dueDate || t.isExam || t.status === 'done') return false;
      return t.dueDate >= weekStart && t.dueDate <= weekEnd;
    });

    // Upcoming exams (not done, future)
    const upcomingExams = school
      .filter(t => t.isExam && t.dueDate && t.dueDate >= todayStr && t.status !== 'done')
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 3);

    // Next scheduled post
    const nextPost = content
      .filter(c => c.postDate && c.postDate >= todayStr && c.status !== 'posted')
      .sort((a, b) => (a.postDate ?? '').localeCompare(b.postDate ?? ''))[0];

    // Active clients
    const activeClients = agency.filter(p =>
      ['active', 'in progress', 'ongoing'].some(s => p.status?.toLowerCase().includes(s))
    );

    const goalsRow = goals[0];
    const weekGoals = goalsRow
      ? [goalsRow.goal1, goalsRow.goal2, goalsRow.goal3].filter(Boolean) as string[]
      : [];

    res.json({
      success: true,
      data: {
        goals: weekGoals,
        stats: {
          assignmentsDueSoon: dueSoon.length,
          nextPostDate: nextPost?.postDate ?? null,
          activeClients: activeClients.length,
          upcomingExams,
        },
        todayEvents: events,
        calendarAuthorized: calAuthorized,
      },
    });
  } catch (err: any) {
    console.error('[Dashboard]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
