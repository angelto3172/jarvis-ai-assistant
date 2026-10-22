import { google } from 'googleapis';
import { db } from '../db';
import { googleTokens } from '../db/schema';
import { desc } from 'drizzle-orm';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  await saveTokens(tokens);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

async function saveTokens(tokens: any) {
  await db.insert(googleTokens).values({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    updatedAt: new Date(),
  });
}

export async function loadTokens() {
  const rows = await db.select().from(googleTokens).orderBy(desc(googleTokens.id)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  const tokens = {
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.expiryDate?.getTime(),
  };
  oauth2Client.setCredentials(tokens);
  return tokens;
}

export async function isAuthorized(): Promise<boolean> {
  const tokens = await loadTokens();
  return !!tokens?.access_token;
}

export async function getCalendarClient() {
  await loadTokens();
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function getTodayEvents() {
  const calendar = await getCalendarClient();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items ?? []).map(e => ({
    id: e.id,
    title: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    description: e.description,
    isAllDay: !e.start?.dateTime,
  }));
}

export async function getTomorrowEvents() {
  const calendar = await getCalendarClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items ?? []).map(e => ({
    id: e.id,
    title: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    isAllDay: !e.start?.dateTime,
  }));
}

export async function getWeekEvents(weekStart: Date) {
  const calendar = await getCalendarClient();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: weekStart.toISOString(),
    timeMax: weekEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items ?? []).map(e => ({
    id: e.id,
    title: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    description: e.description,
    isAllDay: !e.start?.dateTime,
  }));
}

export async function createTimeBlock(params: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
}) {
  const calendar = await getCalendarClient();
  const colorMap: Record<string, string> = {
    school: '9',    // Blueberry
    content: '6',   // Tangerine
    agency: '2',    // Sage
    personal: '1',  // Lavender
  };

  // Google Calendar requires timeZone alongside a dateTime that has no UTC offset.
  // We read TZ from the environment (set to America/Los_Angeles in .env).
  const timeZone = process.env.TZ ?? 'America/Los_Angeles';

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.title,
        description: params.description,
        start: { dateTime: params.startTime, timeZone },
        end:   { dateTime: params.endTime,   timeZone },
        colorId: params.category ? colorMap[params.category] : undefined,
      },
    });
    return res.data;
  } catch (err: any) {
    // Surface the full Google API error so it isn't swallowed as a generic message.
    const apiMessage: string =
      err?.response?.data?.error?.message   // googleapis GaxiosError shape
      ?? err?.errors?.[0]?.message
      ?? err?.message
      ?? 'Unknown Google Calendar error';
    const status: number | undefined = err?.response?.status ?? err?.code;
    console.error(
      `[Calendar] createTimeBlock failed — status=${status ?? 'n/a'} tz=${timeZone}`,
      '\nGoogle API error:', apiMessage,
      '\nParams:', JSON.stringify({ ...params, timeZone }),
    );
    throw new Error(`Google Calendar: ${apiMessage}`);
  }
}

export async function deleteEvent(eventId: string) {
  const calendar = await getCalendarClient();
  await calendar.events.delete({ calendarId: 'primary', eventId });
}
