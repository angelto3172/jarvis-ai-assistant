import { useEffect, useState, useMemo } from 'react';
import { school } from '../../api/client';
import type { SchoolTask } from '../../types';
import { format, parseISO, differenceInDays } from 'date-fns';

type Filter = 'all' | 'assignments' | 'exams';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

function daysLeft(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return differenceInDays(parseISO(dueDate), new Date());
}

export default function School() {
  const [items, setItems] = useState<SchoolTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    course: '',
    assignment: '',
    dueDate: '',
    status: 'todo' as SchoolTask['status'],
    isExam: false,
  });

  useEffect(() => {
    school.list().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.course || !form.assignment) return;
    setSubmitting(true);
    try {
      const created = await school.create({
        course: form.course,
        assignment: form.assignment,
        dueDate: form.dueDate || null,
        status: form.status,
        isExam: form.isExam,
      });
      setItems(prev => [...prev, created]);
      setForm({ course: '', assignment: '', dueDate: '', status: 'todo', isExam: false });
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: number, status: SchoolTask['status']) {
    const updated = await school.update(id, { status });
    setItems(prev => prev.map(t => t.id === id ? updated : t));
  }

  async function handleDelete(id: number) {
    await school.remove(id);
    setItems(prev => prev.filter(t => t.id !== id));
  }

  const filtered = useMemo(() => {
    return items
      .filter(t => {
        if (filter === 'assignments') return !t.isExam;
        if (filter === 'exams') return t.isExam;
        return true;
      })
      .filter(t => t.status !== 'done')
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [items, filter]);

  const exams = items.filter(t => t.isExam && t.dueDate && t.status !== 'done');
  const dueSoon = items.filter(t => {
    const d = daysLeft(t.dueDate);
    return d !== null && d >= 0 && d <= 7 && t.status !== 'done';
  });

  const paceLabel = dueSoon.some(t => (daysLeft(t.dueDate) ?? 99) <= 1) ? 'Critical'
    : dueSoon.length > 3 ? 'Behind' : 'On Track';
  const paceColor = paceLabel === 'Critical' ? 'text-red-400'
    : paceLabel === 'Behind' ? 'text-yellow-400' : 'text-green-400';

  if (loading) return <Loading />;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">School</h1>
          <p className="text-jarvis-muted text-sm">{items.filter(t => t.status !== 'done').length} active tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${paceColor}`}>{paceLabel}</span>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-xs">
            + Add
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card border-jarvis-school/40 bg-jarvis-school/5 space-y-3 animate-slide-up">
          <p className="text-sm font-semibold text-white">New Assignment / Exam</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Course (e.g. Calc 101)"
              value={form.course}
              onChange={e => setForm(f => ({ ...f, course: e.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Assignment name"
              value={form.assignment}
              onChange={e => setForm(f => ({ ...f, assignment: e.target.value }))}
              required
            />
            <input
              className="input"
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
            <select
              className="input"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as SchoolTask['status'] }))}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isExam}
              onChange={e => setForm(f => ({ ...f, isExam: e.target.checked }))}
              className="w-4 h-4 rounded accent-jarvis-school"
            />
            <span className="text-sm text-white">This is an exam</span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Adding...' : 'Add Task'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {/* Exam Countdowns */}
      {exams.length > 0 && (
        <section>
          <p className="section-title">Exam Countdown</p>
          <div className="grid grid-cols-2 gap-3">
            {exams.slice(0, 4).map(exam => {
              const days = daysLeft(exam.dueDate);
              const pct = days !== null ? Math.max(0, Math.min(100, ((30 - days) / 30) * 100)) : 0;
              const color = (days ?? 99) <= 3 ? '#ef4444' : (days ?? 99) <= 7 ? '#f59e0b' : '#6366f1';
              return (
                <div key={exam.id} className="card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white line-clamp-1">{exam.assignment}</p>
                      <p className="text-xs text-jarvis-muted">{exam.course}</p>
                    </div>
                    <span className="badge shrink-0 ml-2" style={{ background: `${color}22`, color }}>
                      {days === 0 ? 'Today' : days === 1 ? '1d' : `${days}d`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-jarvis-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  {exam.dueDate && (
                    <p className="text-[11px] text-jarvis-muted mt-1">{format(parseISO(exam.dueDate), 'EEE, MMM d')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'assignments', 'exams'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-jarvis-school text-white' : 'bg-jarvis-card text-jarvis-muted hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      <section>
        <p className="section-title">{filtered.length} active — sorted by urgency</p>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-jarvis-muted text-sm">Nothing here — add a task above!</p>
            </div>
          )}
          {filtered.map(task => {
            const days = daysLeft(task.dueDate);
            const urgencyClass = days === null ? 'urgency-ok'
              : days <= 1 ? 'urgency-critical'
              : days <= 3 ? 'urgency-warning'
              : 'urgency-ok';
            return (
              <div key={task.id} className="card flex items-center justify-between group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base">{task.isExam ? '📝' : '📋'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{task.assignment}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-jarvis-muted">{task.course}</span>
                      {task.dueDate && (
                        <span className="text-xs text-jarvis-muted">{format(parseISO(task.dueDate), 'MMM d')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {days !== null && (
                    <span className={`badge ${urgencyClass}`}>
                      {days === 0 ? 'Today' : days < 0 ? 'Overdue' : `${days}d`}
                    </span>
                  )}
                  <select
                    className="text-xs bg-jarvis-border text-white rounded px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-jarvis-school"
                    value={task.status}
                    onChange={e => handleStatusChange(task.id, e.target.value as SchoolTask['status'])}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-jarvis-border hover:text-red-400 transition-colors text-sm"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Done tasks */}
      {items.filter(t => t.status === 'done').length > 0 && (
        <section>
          <p className="section-title text-green-600/60">Completed</p>
          <div className="space-y-2">
            {items.filter(t => t.status === 'done').map(task => (
              <div key={task.id} className="card flex items-center justify-between opacity-40">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base line-through">{task.isExam ? '📝' : '📋'}</span>
                  <div>
                    <p className="text-sm text-white line-through truncate">{task.assignment}</p>
                    <p className="text-xs text-jarvis-muted">{task.course}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(task.id, 'todo')}
                    className="text-xs text-jarvis-muted hover:text-white transition-colors"
                  >
                    Undo
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-jarvis-border hover:text-red-400 text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-jarvis-muted text-sm animate-pulse">Loading school tasks...</p>
    </div>
  );
}
