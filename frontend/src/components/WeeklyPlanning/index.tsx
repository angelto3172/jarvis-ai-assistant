import { useEffect, useState } from 'react';
import { planning, calendar, bot } from '../../api/client';
import type { WeeklyGoals, CalendarEvent } from '../../types';
import { format, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns';

const CATEGORIES = ['school', 'content', 'agency', 'personal'] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<Category, string> = {
  school: '#3b82f6',
  content: '#f59e0b',
  agency: '#10b981',
  personal: '#a855f7',
};

export default function WeeklyPlanning() {
  const [goals, setGoals] = useState<WeeklyGoals | null>(null);
  const [draft, setDraft] = useState(['', '', '']);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockStatus, setBlockStatus] = useState<string | null>(null);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  // Time block form state
  const [block, setBlock] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    category: 'school' as Category,
  });

  useEffect(() => {
    Promise.all([
      planning.getGoals(0),
      planning.weekEvents(),
    ]).then(([g, e]) => {
      setGoals(g);
      setDraft([g.goal1 ?? '', g.goal2 ?? '', g.goal3 ?? '']);
      setEvents(e);
    }).finally(() => setLoading(false));
  }, []);

  async function saveGoals() {
    setSaving(true);
    try {
      const updated = await planning.saveGoals({
        weekStart: weekStartStr,
        goal1: draft[0] || undefined,
        goal2: draft[1] || undefined,
        goal3: draft[2] || undefined,
      });
      setGoals(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function pushTimeBlock() {
    setBlockStatus('Pushing to Calendar...');
    try {
      const startDateTime = `${block.date}T${block.startTime}:00`;
      const endDateTime = `${block.date}T${block.endTime}:00`;
      await calendar.createBlock({
        title: block.title,
        description: block.description || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        category: block.category,
      });
      setBlockStatus('Added to Google Calendar!');
      // Refresh events
      const updated = await planning.weekEvents();
      setEvents(updated);
      setTimeout(() => {
        setBlockStatus(null);
        setShowBlockForm(false);
        setBlock(b => ({ ...b, title: '', description: '' }));
      }, 2000);
    } catch {
      setBlockStatus('Failed — is Google Calendar connected?');
      setTimeout(() => setBlockStatus(null), 3000);
    }
  }

  async function sendWeeklyPrompt() {
    await bot.triggerWeeklyPrompt();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-jarvis-muted text-sm animate-pulse">Loading weekly plan...</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Planning</h1>
          <p className="text-jarvis-muted text-sm">
            Week of {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </p>
        </div>
        <button onClick={sendWeeklyPrompt} className="btn-ghost text-xs">
          📨 Send to Telegram
        </button>
      </div>

      {/* Top 3 Goals */}
      <section>
        <p className="section-title">Top 3 Goals This Week</p>
        <div className="card space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-jarvis-accent/20 text-jarvis-accent flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <input
                className="input flex-1"
                placeholder={`Goal ${i + 1}...`}
                value={draft[i]}
                onChange={e => setDraft(d => { const n = [...d]; n[i] = e.target.value; return n; })}
                onKeyDown={e => { if (e.key === 'Enter') saveGoals(); }}
              />
            </div>
          ))}
          <button
            onClick={saveGoals}
            disabled={saving}
            className="btn-primary w-full justify-center mt-2"
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Goals'}
          </button>
        </div>
      </section>

      {/* Week Calendar */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">Week Calendar</p>
          <button
            onClick={() => setShowBlockForm(v => !v)}
            className="btn-primary text-xs"
          >
            + Add Time Block
          </button>
        </div>

        {/* Add Time Block Form */}
        {showBlockForm && (
          <div className="card mb-3 space-y-3 border-jarvis-accent/40 bg-jarvis-accent/5 animate-slide-up">
            <p className="text-sm font-semibold text-white">Push Time Block to Google Calendar</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input col-span-2"
                placeholder="Block title..."
                value={block.title}
                onChange={e => setBlock(b => ({ ...b, title: e.target.value }))}
              />
              <input
                className="input"
                type="date"
                value={block.date}
                onChange={e => setBlock(b => ({ ...b, date: e.target.value }))}
              />
              <select
                className="input"
                value={block.category}
                onChange={e => setBlock(b => ({ ...b, category: e.target.value as Category }))}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <input
                className="input"
                type="time"
                value={block.startTime}
                onChange={e => setBlock(b => ({ ...b, startTime: e.target.value }))}
              />
              <input
                className="input"
                type="time"
                value={block.endTime}
                onChange={e => setBlock(b => ({ ...b, endTime: e.target.value }))}
              />
              <input
                className="input col-span-2"
                placeholder="Description (optional)..."
                value={block.description}
                onChange={e => setBlock(b => ({ ...b, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={pushTimeBlock}
                disabled={!block.title || !!blockStatus}
                className="btn-primary flex-1 justify-center"
              >
                {blockStatus ?? 'Push to Calendar'}
              </button>
              <button onClick={() => setShowBlockForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {/* 7-day grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const dayEvents = events.filter(e => e.start && isSameDay(parseISO(e.start), day));
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={i}
                className={`card min-h-28 ${isToday ? 'border-jarvis-accent/50 bg-jarvis-accent/5' : ''}`}
              >
                <p className={`text-[11px] font-semibold mb-1.5 ${isToday ? 'text-jarvis-accent' : 'text-jarvis-muted'}`}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  <span className="block text-base font-bold text-white">{format(day, 'd')}</span>
                </p>
                <div className="space-y-1">
                  {dayEvents.map((ev, j) => (
                    <div key={ev.id ?? j} className="bg-jarvis-accent/20 text-jarvis-accent rounded px-1.5 py-1 text-[10px]">
                      <p className="font-medium truncate">{ev.title}</p>
                      {!ev.isAllDay && ev.start && (
                        <p className="opacity-70">{format(parseISO(ev.start), 'h:mm a')}</p>
                      )}
                    </div>
                  ))}
                  {dayEvents.length === 0 && <p className="text-[10px] text-jarvis-border">Free</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category legend */}
      <div className="flex gap-4">
        {CATEGORIES.map(c => (
          <div key={c} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[c] }} />
            <span className="text-xs text-jarvis-muted capitalize">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
