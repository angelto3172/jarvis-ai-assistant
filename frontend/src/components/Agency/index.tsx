import { useEffect, useState, useMemo } from 'react';
import { agency } from '../../api/client';
import type { AgencyProject } from '../../types';
import { format, parseISO } from 'date-fns';

const WEEKLY_REVENUE_GOAL = 2000;

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-jarvis-agency/10 text-jarvis-agency',
  proposal: 'bg-jarvis-accent/10 text-jarvis-accent',
  completed: 'bg-jarvis-border text-jarvis-muted',
  paused: 'bg-yellow-400/10 text-yellow-400',
};

export default function Agency() {
  const [items, setItems] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    client: '',
    project: '',
    status: 'active' as AgencyProject['status'],
    deadline: '',
    revenue: '',
  });

  useEffect(() => {
    agency.list().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client || !form.project) return;
    setSubmitting(true);
    try {
      const created = await agency.create({
        client: form.client,
        project: form.project,
        status: form.status,
        deadline: form.deadline || null,
        revenue: form.revenue ? parseInt(form.revenue) : null,
      });
      setItems(prev => [...prev, created]);
      setForm({ client: '', project: '', status: 'active', deadline: '', revenue: '' });
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: number, status: AgencyProject['status']) {
    const updated = await agency.update(id, { status });
    setItems(prev => prev.map(p => p.id === id ? updated : p));
  }

  async function handleDelete(id: number) {
    await agency.remove(id);
    setItems(prev => prev.filter(p => p.id !== id));
  }

  const statuses = useMemo(() => {
    const s = new Set(items.map(i => i.status));
    return ['all', ...Array.from(s)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => statusFilter === 'all' || i.status === statusFilter);
  }, [items, statusFilter]);

  const active = items.filter(i => i.status === 'active');
  const pipeline = items.filter(i => i.status === 'proposal');
  const totalRevenue = active.reduce((sum, i) => sum + (i.revenue ?? 0), 0);
  const revenueProgress = Math.min(100, (totalRevenue / WEEKLY_REVENUE_GOAL) * 100);

  if (loading) return <Loading />;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agency</h1>
          <p className="text-jarvis-muted text-sm">{items.length} projects · {active.length} active</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-xs">
          + Add Client
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card border-jarvis-agency/40 bg-jarvis-agency/5 space-y-3 animate-slide-up">
          <p className="text-sm font-semibold text-white">New Client / Project</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Client name"
              value={form.client}
              onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Project name"
              value={form.project}
              onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
              required
            />
            <select
              className="input"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as AgencyProject['status'] }))}
            >
              <option value="active">Active</option>
              <option value="proposal">Proposal</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder="Revenue ($)"
              value={form.revenue}
              onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))}
            />
            <input
              className="input col-span-2"
              type="date"
              placeholder="Deadline (optional)"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Adding...' : 'Add Project'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="section-title">Active</p>
          <p className="text-3xl font-bold text-jarvis-agency">{active.length}</p>
        </div>
        <div className="card">
          <p className="section-title">Pipeline</p>
          <p className="text-3xl font-bold text-jarvis-accent">{pipeline.length}</p>
        </div>
        <div className="card">
          <p className="section-title">Revenue</p>
          <p className="text-3xl font-bold text-jarvis-agency">${totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Revenue Goal */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Weekly Revenue Goal</p>
          <p className="text-sm font-bold text-jarvis-agency">
            ${totalRevenue.toLocaleString()} / ${WEEKLY_REVENUE_GOAL.toLocaleString()}
          </p>
        </div>
        <div className="h-2 bg-jarvis-border rounded-full overflow-hidden">
          <div
            className="h-full bg-jarvis-agency rounded-full transition-all duration-500"
            style={{ width: `${revenueProgress}%` }}
          />
        </div>
        <p className="text-xs text-jarvis-muted mt-1">{revenueProgress.toFixed(0)}% of goal</p>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              statusFilter === s ? 'bg-jarvis-agency text-white' : 'bg-jarvis-card text-jarvis-muted hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Project List */}
      <section>
        <p className="section-title">{filtered.length} projects</p>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-jarvis-muted text-sm">No projects yet — add one above!</p>
            </div>
          )}
          {filtered.map(item => (
            <div key={item.id} className="card flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  item.status === 'active' ? 'bg-jarvis-agency'
                  : item.status === 'proposal' ? 'bg-jarvis-accent'
                  : item.status === 'paused' ? 'bg-yellow-400'
                  : 'bg-jarvis-border'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.project}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-jarvis-muted">{item.client}</span>
                    {item.deadline && (
                      <span className="text-xs text-jarvis-muted">due {format(parseISO(item.deadline), 'MMM d')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {item.revenue != null && (
                  <span className="text-sm font-semibold text-jarvis-agency">${item.revenue.toLocaleString()}</span>
                )}
                <select
                  className="text-xs bg-jarvis-border text-white rounded px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-jarvis-agency"
                  value={item.status}
                  onChange={e => handleStatusChange(item.id, e.target.value as AgencyProject['status'])}
                >
                  <option value="active">Active</option>
                  <option value="proposal">Proposal</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
                <button onClick={() => handleDelete(item.id)} className="text-jarvis-border hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-jarvis-muted text-sm animate-pulse">Loading agency data...</p>
    </div>
  );
}
