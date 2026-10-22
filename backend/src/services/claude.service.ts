import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { schoolTasks, contentPosts, agencyProjects } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  getTodayEvents,
  getTomorrowEvents,
  createTimeBlock,
  isAuthorized,
} from './calendar.service';

// ─── Client ───────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;
const MAX_LOOP_ITERATIONS = 8;

// ─── Date helpers ─────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function weekEndStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(now);
  sunday.setDate(diff);
  return sunday.toISOString().split('T')[0];
}

// ─── Tool definitions ─────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  // ── School ──
  {
    name: 'list_school_tasks',
    description:
      'Query school assignments and exams from the database. Use filter="active" for pending tasks, "this_week" for due within 7 days, "exams" for exams only, "assignments" for non-exam tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'exams', 'assignments', 'this_week'],
          description: 'Which tasks to return',
        },
      },
      required: ['filter'],
    },
  },
  {
    name: 'add_school_task',
    description: 'Add a new assignment or exam to the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        course: { type: 'string', description: 'Course name (e.g. "Calculus", "History 101")' },
        assignment: { type: 'string', description: 'Assignment or exam name' },
        dueDate: {
          type: 'string',
          description: 'Due date in YYYY-MM-DD format, or omit if unspecified',
        },
        isExam: {
          type: 'boolean',
          description: 'true for exams/tests/quizzes, false for regular assignments',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress'],
          description: 'Initial status (defaults to todo)',
        },
      },
      required: ['course', 'assignment', 'isExam'],
    },
  },
  {
    name: 'update_school_task',
    description:
      'Update the status of a school task. First call list_school_tasks to find the task ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'number', description: 'The numeric ID of the task' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'New status',
        },
      },
      required: ['taskId', 'status'],
    },
  },

  // ── Content ──
  {
    name: 'list_content_posts',
    description:
      'Query content posts and ideas from the database. Use filter="ideas" for backlog, "scheduled" for upcoming posts, "this_week" for posts due this week.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'ideas', 'scheduled', 'posted', 'this_week'],
          description: 'Which posts to return',
        },
      },
      required: ['filter'],
    },
  },
  {
    name: 'add_content_post',
    description: 'Add a new content post or idea to the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title or description of the post/idea' },
        platform: {
          type: 'string',
          description: 'Platform (e.g. Instagram, TikTok, YouTube, Twitter/X, LinkedIn)',
        },
        status: {
          type: 'string',
          enum: ['idea', 'in_progress', 'scheduled', 'posted'],
          description: 'Status of the post',
        },
        postDate: {
          type: 'string',
          description: 'Post date in YYYY-MM-DD format, or omit if not scheduled yet',
        },
      },
      required: ['title', 'status'],
    },
  },
  {
    name: 'update_content_post',
    description:
      'Update a content post (change status, mark as posted, update date). First call list_content_posts to find the post ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        postId: { type: 'number', description: 'The numeric ID of the post' },
        status: {
          type: 'string',
          enum: ['idea', 'in_progress', 'scheduled', 'posted'],
          description: 'New status',
        },
        postDate: {
          type: 'string',
          description: 'Updated post date in YYYY-MM-DD format',
        },
      },
      required: ['postId'],
    },
  },

  // ── Agency ──
  {
    name: 'list_agency_projects',
    description: 'Query agency clients and projects from the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'proposal', 'completed', 'paused'],
          description: 'Filter by project status',
        },
      },
      required: ['filter'],
    },
  },
  {
    name: 'add_agency_project',
    description: 'Add a new client or project to the agency database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client: { type: 'string', description: 'Client name' },
        project: { type: 'string', description: 'Project name or description' },
        status: {
          type: 'string',
          enum: ['active', 'proposal', 'paused', 'completed'],
          description: 'Project status',
        },
        revenue: {
          type: 'number',
          description: 'Revenue amount in dollars (optional)',
        },
        deadline: {
          type: 'string',
          description: 'Deadline in YYYY-MM-DD format (optional)',
        },
      },
      required: ['client', 'project', 'status'],
    },
  },
  {
    name: 'update_agency_project',
    description:
      'Update an agency project (status, revenue, etc). First call list_agency_projects to find the project ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'number', description: 'The numeric ID of the project' },
        status: {
          type: 'string',
          enum: ['active', 'proposal', 'paused', 'completed'],
          description: 'New status',
        },
        revenue: { type: 'number', description: 'Updated revenue amount in dollars' },
      },
      required: ['projectId'],
    },
  },

  // ── Calendar ──
  {
    name: 'get_calendar_events',
    description:
      'Get Google Calendar events for today or tomorrow. Returns an error if Google Calendar is not connected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day: {
          type: 'string',
          enum: ['today', 'tomorrow'],
          description: 'Which day to retrieve events for',
        },
      },
      required: ['day'],
    },
  },
  {
    name: 'create_calendar_block',
    description:
      'Push a time block onto Google Calendar. Requires Google Calendar to be connected. Use this when Angel says "block X hours for Y on [day]".',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Name of the time block' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        startTime: { type: 'string', description: 'Start time in HH:MM (24-hour)' },
        endTime: { type: 'string', description: 'End time in HH:MM (24-hour)' },
        category: {
          type: 'string',
          enum: ['school', 'content', 'agency', 'personal'],
          description: 'Category for color-coding',
        },
      },
      required: ['title', 'date', 'startTime', 'endTime'],
    },
  },

  // ── Summary ──
  {
    name: 'get_full_summary',
    description:
      'Fetch everything at once: pending school tasks, upcoming exams, scheduled content, active agency projects, and today\'s calendar. Use this for "what should I focus on today", "how am I doing", or "give me a summary" requests.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {

      // ── School ──────────────────────────────────────────
      case 'list_school_tasks': {
        const today = todayStr();
        const weekEnd = weekEndStr();
        let tasks = await db.select().from(schoolTasks);

        const f = input.filter as string;
        if (f === 'active')       tasks = tasks.filter(t => t.status !== 'done');
        else if (f === 'exams')   tasks = tasks.filter(t => t.isExam && t.status !== 'done');
        else if (f === 'assignments') tasks = tasks.filter(t => !t.isExam && t.status !== 'done');
        else if (f === 'this_week')   tasks = tasks.filter(
          t => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd && t.status !== 'done'
        );

        tasks.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });

        // Enrich with days-left
        const enriched = tasks.map(t => ({
          ...t,
          daysLeft: t.dueDate
            ? Math.round((new Date(t.dueDate).getTime() - new Date(today).getTime()) / 86_400_000)
            : null,
        }));

        return JSON.stringify({ count: enriched.length, tasks: enriched });
      }

      case 'add_school_task': {
        const [task] = await db.insert(schoolTasks).values({
          course: input.course as string,
          assignment: input.assignment as string,
          dueDate: (input.dueDate as string | undefined) ?? null,
          isExam: input.isExam as boolean,
          status: (input.status as 'todo' | 'in_progress') ?? 'todo',
        }).returning();
        return JSON.stringify({ success: true, task });
      }

      case 'update_school_task': {
        const [task] = await db.update(schoolTasks)
          .set({ status: input.status as 'todo' | 'in_progress' | 'done' })
          .where(eq(schoolTasks.id, input.taskId as number))
          .returning();
        return task
          ? JSON.stringify({ success: true, task })
          : JSON.stringify({ success: false, error: 'Task not found' });
      }

      // ── Content ──────────────────────────────────────────
      case 'list_content_posts': {
        const today = todayStr();
        const weekEnd = weekEndStr();
        let posts = await db.select().from(contentPosts);

        const f = input.filter as string;
        if (f === 'ideas')      posts = posts.filter(p => p.status === 'idea');
        else if (f === 'scheduled') posts = posts.filter(p => ['in_progress', 'scheduled'].includes(p.status));
        else if (f === 'posted')    posts = posts.filter(p => p.status === 'posted');
        else if (f === 'this_week') posts = posts.filter(
          p => p.postDate && p.postDate >= today && p.postDate <= weekEnd
        );

        posts.sort((a, b) => (a.postDate ?? '').localeCompare(b.postDate ?? ''));
        return JSON.stringify({ count: posts.length, posts });
      }

      case 'add_content_post': {
        const [post] = await db.insert(contentPosts).values({
          title: input.title as string,
          platform: (input.platform as string | undefined) ?? null,
          status: (input.status as 'idea' | 'in_progress' | 'scheduled' | 'posted') ?? 'idea',
          postDate: (input.postDate as string | undefined) ?? null,
        }).returning();
        return JSON.stringify({ success: true, post });
      }

      case 'update_content_post': {
        const updates: Partial<{ status: string; postDate: string | null }> = {};
        if (input.status !== undefined)   updates.status   = input.status as string;
        if (input.postDate !== undefined) updates.postDate = (input.postDate as string | null);

        const [post] = await db.update(contentPosts)
          .set(updates)
          .where(eq(contentPosts.id, input.postId as number))
          .returning();
        return post
          ? JSON.stringify({ success: true, post })
          : JSON.stringify({ success: false, error: 'Post not found' });
      }

      // ── Agency ───────────────────────────────────────────
      case 'list_agency_projects': {
        let projects = await db.select().from(agencyProjects);

        const f = input.filter as string;
        if (f !== 'all') projects = projects.filter(p => p.status === f);

        return JSON.stringify({ count: projects.length, projects });
      }

      case 'add_agency_project': {
        const [project] = await db.insert(agencyProjects).values({
          client: input.client as string,
          project: input.project as string,
          status: (input.status as 'active' | 'proposal' | 'paused' | 'completed') ?? 'active',
          revenue: input.revenue !== undefined ? (input.revenue as number) : null,
          deadline: (input.deadline as string | undefined) ?? null,
        }).returning();
        return JSON.stringify({ success: true, project });
      }

      case 'update_agency_project': {
        const updates: Partial<{ status: string; revenue: number | null }> = {};
        if (input.status !== undefined)  updates.status  = input.status as string;
        if (input.revenue !== undefined) updates.revenue = input.revenue as number;

        const [project] = await db.update(agencyProjects)
          .set(updates)
          .where(eq(agencyProjects.id, input.projectId as number))
          .returning();
        return project
          ? JSON.stringify({ success: true, project })
          : JSON.stringify({ success: false, error: 'Project not found' });
      }

      // ── Calendar ─────────────────────────────────────────
      case 'get_calendar_events': {
        const connected = await isAuthorized();
        if (!connected) {
          return JSON.stringify({
            error: 'Google Calendar is not connected. Connect it at http://localhost:5173',
          });
        }
        const events = input.day === 'today'
          ? await getTodayEvents()
          : await getTomorrowEvents();
        return JSON.stringify({ day: input.day, count: events.length, events });
      }

      case 'create_calendar_block': {
        const connected = await isAuthorized();
        if (!connected) {
          return JSON.stringify({
            error: 'Google Calendar is not connected. Connect it at http://localhost:5173',
          });
        }
        // Build naive local datetimes — createTimeBlock attaches the TZ env to them.
        const startTime = `${input.date}T${input.startTime}:00`;
        const endTime   = `${input.date}T${input.endTime}:00`;
        console.log(`[Claude tool] create_calendar_block — title="${input.title}" start=${startTime} end=${endTime} tz=${process.env.TZ}`);
        try {
          const event = await createTimeBlock({
            title: input.title as string,
            startTime,
            endTime,
            category: input.category as string | undefined,
          });
          return JSON.stringify({ success: true, eventId: event.id, link: event.htmlLink });
        } catch (calErr: any) {
          // Return the real Google error message so Claude can relay it to the user.
          return JSON.stringify({ success: false, error: calErr.message });
        }
      }

      // ── Full Summary ──────────────────────────────────────
      case 'get_full_summary': {
        const today = todayStr();
        const weekEnd = weekEndStr();

        const [allSchool, allContent, allAgency] = await Promise.all([
          db.select().from(schoolTasks),
          db.select().from(contentPosts),
          db.select().from(agencyProjects),
        ]);

        // School summary
        const pending  = allSchool.filter(t => t.status !== 'done');
        const overdue  = pending.filter(t => t.dueDate && t.dueDate < today);
        const dueSoon  = pending.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
        const exams    = pending
          .filter(t => t.isExam && t.dueDate && t.dueDate >= today)
          .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
          .slice(0, 3)
          .map(t => ({
            ...t,
            daysLeft: Math.round(
              (new Date(t.dueDate!).getTime() - new Date(today).getTime()) / 86_400_000
            ),
          }));

        // Content summary
        const scheduledPosts = allContent
          .filter(p => p.postDate && p.postDate >= today && p.status !== 'posted')
          .sort((a, b) => (a.postDate ?? '').localeCompare(b.postDate ?? ''));
        const ideas = allContent.filter(p => p.status === 'idea');

        // Agency summary
        const active  = allAgency.filter(p => p.status === 'active');
        const pipeline = allAgency.filter(p => p.status === 'proposal');
        const totalRevenue = active.reduce((sum, p) => sum + (p.revenue ?? 0), 0);

        // Calendar (best-effort)
        const calConnected = await isAuthorized();
        let todayEvents: unknown[] = [];
        if (calConnected) {
          try { todayEvents = await getTodayEvents(); } catch { /* ignore */ }
        }

        return JSON.stringify({
          school: {
            totalPending: pending.length,
            overdue: overdue.map(t => ({ id: t.id, assignment: t.assignment, course: t.course, dueDate: t.dueDate })),
            dueSoon: dueSoon.map(t => ({
              id: t.id, assignment: t.assignment, course: t.course, dueDate: t.dueDate, isExam: t.isExam,
              daysLeft: Math.round((new Date(t.dueDate!).getTime() - new Date(today).getTime()) / 86_400_000),
            })),
            upcomingExams: exams,
          },
          content: {
            scheduledThisWeek: scheduledPosts.filter(p => p.postDate! <= weekEnd).length,
            nextPost: scheduledPosts[0] ?? null,
            ideaBacklog: ideas.length,
          },
          agency: {
            activeClients: active.length,
            pipeline: pipeline.length,
            totalRevenue,
            activeProjects: active.map(p => ({ id: p.id, client: p.client, project: p.project, revenue: p.revenue })),
          },
          calendar: { connected: calConnected, todayEvents },
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    // Unwrap googleapis GaxiosError for a readable message
    const msg: string =
      err?.response?.data?.error?.message ?? err?.message ?? String(err);
    console.error(`[Claude tool error] ${name} — ${msg}`, '\nInput:', JSON.stringify(input));
    return JSON.stringify({ error: msg });
  }
}

// ─── System prompt (cached) ───────────────────────────────────
function buildSystemPrompt(): Anthropic.TextBlockParam {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return {
    type: 'text',
    text: `You are Jarvis, Angel's personal AI productivity assistant. Angel is a college student simultaneously managing school, content creation, and a marketing agency.

Today is ${dateStr}.

You can query and update Angel's data using the provided tools:
- 📚 School — assignments and exams (PostgreSQL)
- 🎬 Content — posts and ideas (PostgreSQL)
- 💼 Agency — clients and projects (PostgreSQL)
- 📅 Calendar — Google Calendar events and time blocks

RESPONSE GUIDELINES:
- Be concise and friendly. This is Telegram — keep it brief.
- Use emojis to organize information (📚 school, 🎬 content, 💼 agency, 📅 calendar).
- Show dates in human-readable form ("Monday, Apr 14" not "2025-04-14").
- For "mark X as done" or "update X" — first call the list tool to find the ID, then update.
- For "what should I focus on" / "give me a summary" / "how am I doing" → call get_full_summary and give a smart, prioritized recommendation. Lead with the most urgent item.
- When adding something, confirm with the key details you used.
- If unclear, ask one focused clarifying question.
- Never expose raw IDs or JSON to Angel in your final reply.`,
    // Prompt caching — this system prompt is the same for every request
    cache_control: { type: 'ephemeral' },
  };
}

// ─── Public API ───────────────────────────────────────────────
export type ConversationHistory = Array<{ role: 'user' | 'assistant'; content: string }>;

export async function processMessage(
  userMessage: string,
  history: ConversationHistory,
): Promise<string> {
  // Build messages array from history + new message
  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  // Agentic tool-use loop
  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [buildSystemPrompt()],
      tools: TOOLS,
      messages,
    });

    // Append assistant turn
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return textBlock?.text ?? '✅ Done!';
    }

    if (response.stop_reason === 'tool_use') {
      const toolCalls = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolCalls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
          const result = await executeTool(call.name, call.input as Record<string, unknown>);
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: result,
          };
        }),
      );

      messages.push({ role: 'user', content: toolResults });
    } else {
      // Unexpected stop reason
      break;
    }
  }

  return "⚠️ I couldn't complete that request. Please try again.";
}
