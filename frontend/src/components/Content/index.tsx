import { useEffect, useState, useMemo } from 'react';
import { content } from '../../api/client';
import type { ContentPost } from '../../types';
import { format, parseISO, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'LinkedIn', 'Other'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Content() {
  const [items, setItems] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'backlog'>('calendar');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    platform: '',
    status: 'idea' as ContentPost['status'],
    postDate: '',
  });

  useEffect(() => {
    content.list().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    try {
      const created = await content.create({
        title: form.title,
        platform: form.platform || null,
        status: form.status,
        postDate: form.postDate || null,
      });
      setItems(prev => [...prev, created]);
      setForm({ title: '', platform: '', status: 'idea', postDate: '' });
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: number, status: ContentPost['status']) {
    const updated = await content.update(id, { status });
    setItems(prev => prev.map(p => p.id === id ? updated : p));
  }

  async function handleDelete(id: number) {
    await content.remove(id);
    setItems(prev => prev.filter(p => p.id !== id));
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const scheduled = items.filter(p => p.postDate && p.status !== 'idea');
  const backlog = items.filter(p => p.status === 'idea' || !p.postDate);

  // Posting streak
  const streak = useMemo(() => {
    const posted = items
      .filter(p => p.postDate && p.status === 'posted')
      .map(p => format(parseISO(p.postDate!), 'yyyy-MM-dd'));
    const unique = [...new Set(posted)].sort().reverse();
    let count = 0;
    let check = new Date();
    for (const d of unique) {
      const pd = parseISO(d);
      if (isSameDay(pd, check) || isSameDay(pd, subDays(check, 1))) {
        count++;
        check = subDays(check, 1);
      } else break;
    }
    return count;
  }, [items]);

  if (loading) return <Loading />;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content</h1>
          <p className="text-jarvis-muted text-sm">{scheduled.length} scheduled · {backlog.length} ideas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="card py-2 px-3 flex items-center gap-2">
            <span className="text-jarvis-content text-lg">🔥</span>
            <div>
              <p className="text-white text-sm font-bold">{streak}</p>
              <p className="text-[10px] text-jarvis-muted">day streak</p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-xs">
            + Add
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card border-jarvis-content/40 bg-jarvis-content/5 space-y-3 animate-slide-up">
          <p className="text-sm font-semibold text-white">New Post / Idea</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input col-span-2"
              placeholder="Post title or idea..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
            <select
              className="input"
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
            >
              <option value="">Platform (optional)</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="input"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as ContentPost['status'] }))}
            >
              <option value="idea">Idea</option>
              <option value="in_progress">In Progress</option>
              <option value="scheduled">Scheduled</option>
              <option value="posted">Posted</option>
            </select>
            {form.status !== 'idea' && (
              <input
                className="input col-span-2"
                type="date"
                placeholder="Post date"
                value={form.postDate}
                onChange={e => setForm(f => ({ ...f, postDate: e.target.value }))}
              />
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        {(['calendar', 'backlog'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === v ? 'bg-jarvis-content text-white' : 'bg-jarvis-card text-jarvis-muted hover:text-white'
            }`}
          >
            {v === 'calendar' ? '📅 Weekly Calendar' : '💡 Idea Backlog'}
          </button>
        ))}
      </div>

      {/* Weekly Calendar */}
      {view === 'calendar' && (
        <>
          <section>
            <p className="section-title">Week of {format(weekStart, 'MMM d, yyyy')}</p>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => {
                const dayPosts = scheduled.filter(p => p.postDate && isSameDay(parseISO(p.postDate), day));
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={i} className={`card min-h-24 ${isToday ? 'border-jarvis-content/50 bg-jarvis-content/5' : ''}`}>
                    <p className={`text-[11px] font-semibold mb-2 ${isToday ? 'text-jarvis-content' : 'text-jarvis-muted'}`}>
                      {DAYS[i]}
                      <span className="block text-base font-bold text-white">{format(day, 'd')}</span>
                    </p>
                    <div className="space-y-1">
                      {dayPosts.map(post => (
                        <div key={post.id} className="bg-jarvis-content/20 text-jarvis-content rounded px-1.5 py-1 text-[10px]">
                          <p className="font-medium truncate">{post.title}</p>
                          {post.platform && <p className="opacity-70">{post.platform}</p>}
                        </div>
                      ))}
                      {dayPosts.length === 0 && <p className="text-[10px] text-jarvis-border">—</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <p className="section-title">All Scheduled & Posted</p>
            <ContentList
              items={[...scheduled].sort((a, b) => (a.postDate ?? '').localeCompare(b.postDate ?? ''))}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </section>
        </>
      )}

      {/* Idea Backlog */}
      {view === 'backlog' && (
        <section>
          <p className="section-title">{backlog.length} ideas in backlog</p>
          <ContentList items={backlog} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        </section>
      )}
    </div>
  );
}

function ContentList({
  items,
  onStatusChange,
  onDelete,
}: {
  items: ContentPost[];
  onStatusChange: (id: number, s: ContentPost['status']) => void;
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-jarvis-muted text-sm">Nothing here yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(post => (
        <div key={post.id} className="card flex items-center justify-between group">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base">{post.status === 'idea' ? '💡' : post.status === 'posted' ? '✅' : '📱'}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{post.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {post.platform && <span className="text-xs text-jarvis-muted">{post.platform}</span>}
                {post.postDate && (
                  <span className="text-xs text-jarvis-muted">{format(parseISO(post.postDate), 'MMM d')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <select
              className="text-xs bg-jarvis-border text-white rounded px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-jarvis-content"
              value={post.status}
              onChange={e => onStatusChange(post.id, e.target.value as ContentPost['status'])}
            >
              <option value="idea">Idea</option>
              <option value="in_progress">In Progress</option>
              <option value="scheduled">Scheduled</option>
              <option value="posted">Posted</option>
            </select>
            <button onClick={() => onDelete(post.id)} className="text-jarvis-border hover:text-red-400 text-sm">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-jarvis-muted text-sm animate-pulse">Loading content...</p>
    </div>
  );
}
