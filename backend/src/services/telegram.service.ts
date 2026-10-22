import axios from 'axios';

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

export async function sendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: parseMode,
    });
  } catch (err: any) {
    console.error('[Telegram] Failed to send message:', err.response?.data ?? err.message);
  }
}

export async function sendMorningBriefing(priorities: string[], events: any[]) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const priorityLines = priorities.length > 0
    ? priorities.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
    : '  No priorities set for today.';

  const eventLines = events.length > 0
    ? events.map(e => {
        const time = e.isAllDay ? '(All day)' : formatTime(e.start);
        return `  • ${time} — ${e.title}`;
      }).join('\n')
    : '  No calendar events today.';

  const message = `☀️ <b>Good morning! Here's your Jarvis briefing for ${today}</b>\n\n` +
    `🎯 <b>Top 3 Priorities</b>\n${priorityLines}\n\n` +
    `📅 <b>Today's Calendar</b>\n${eventLines}\n\n` +
    `Make it count! 💪`;

  await sendMessage(message);
}

export async function sendExamAlert(examName: string, daysLeft: number, examDate: string) {
  const urgencyEmoji = daysLeft === 1 ? '🚨' : daysLeft === 3 ? '⚠️' : '📚';
  const message = `${urgencyEmoji} <b>Exam Alert: ${examName}</b>\n\n` +
    `You have <b>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</b> until this exam!\n` +
    `📅 Date: ${examDate}\n\n` +
    `${daysLeft === 1 ? 'Last chance to review! You got this! 🔥' : daysLeft === 3 ? 'Three days — time to review your notes.' : 'A week away — start reviewing.'}`;

  await sendMessage(message);
}

export async function sendWeeklyPlanningPrompt(upcomingItems: {
  assignments: any[];
  events: any[];
  posts: any[];
}) {
  const assignmentLines = upcomingItems.assignments.slice(0, 5).map(a =>
    `  • ${a.name}${a.dueDate ? ` (due ${formatDate(a.dueDate)})` : ''}`
  ).join('\n') || '  None this week';

  const eventLines = upcomingItems.events.slice(0, 5).map(e =>
    `  • ${e.title} — ${formatDate(e.start)}`
  ).join('\n') || '  No events';

  const postLines = upcomingItems.posts.slice(0, 3).map(p =>
    `  • ${p.name}${p.postDate ? ` (${formatDate(p.postDate)})` : ''}`
  ).join('\n') || '  No posts scheduled';

  const message = `🗓️ <b>Sunday Planning Time! Let's map out your week.</b>\n\n` +
    `📚 <b>Upcoming Assignments</b>\n${assignmentLines}\n\n` +
    `📅 <b>Calendar This Week</b>\n${eventLines}\n\n` +
    `📱 <b>Content Scheduled</b>\n${postLines}\n\n` +
    `➡️ Head to <a href="http://localhost:5173/planning">Jarvis Weekly Planning</a> to set your top 3 goals and time blocks for the week!`;

  await sendMessage(message);
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
