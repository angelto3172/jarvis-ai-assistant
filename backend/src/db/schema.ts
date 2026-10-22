import { pgTable, serial, text, timestamp, integer, boolean, date } from 'drizzle-orm/pg-core';

// ─── Core data tables ─────────────────────────────────────────
export const schoolTasks = pgTable('school_tasks', {
  id: serial('id').primaryKey(),
  course: text('course').notNull(),
  assignment: text('assignment').notNull(),
  dueDate: date('due_date'),
  status: text('status').notNull().default('todo'), // todo | in_progress | done
  isExam: boolean('is_exam').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentPosts = pgTable('content_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  platform: text('platform'),     // instagram | youtube | tiktok | twitter | etc.
  status: text('status').notNull().default('idea'), // idea | in_progress | scheduled | posted
  postDate: date('post_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agencyProjects = pgTable('agency_projects', {
  id: serial('id').primaryKey(),
  client: text('client').notNull(),
  project: text('project').notNull(),
  status: text('status').notNull().default('active'), // active | proposal | completed | paused
  deadline: date('deadline'),
  revenue: integer('revenue'),    // in dollars
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── App infrastructure tables ────────────────────────────────
export const weeklyGoals = pgTable('weekly_goals', {
  id: serial('id').primaryKey(),
  weekStart: date('week_start').notNull(),
  goal1: text('goal1'),
  goal2: text('goal2'),
  goal3: text('goal3'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleTokens = pgTable('google_tokens', {
  id: serial('id').primaryKey(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiryDate: timestamp('expiry_date'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const examAlerts = pgTable('exam_alerts', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().unique(),
  examName: text('exam_name').notNull(),
  examDate: date('exam_date').notNull(),
  alertSent7: boolean('alert_sent_7').default(false),
  alertSent3: boolean('alert_sent_3').default(false),
  alertSent1: boolean('alert_sent_1').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
