import { useEffect, useState } from 'react';
import { dashboard, calendar, bot } from '../../api/client';
import type { DashboardData } from '../../types';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<string | null>(null);

  useEffect(() => {
    dashboard.get()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleConnectGoogle() {
    const url = await calendar.authUrl();
    window.location.href = url;
  }

  async function triggerBriefing() {
    setBotStatus('Sending...');
    try {
      await bot.triggerBriefing();
      setBotStatus('Sent to Telegram!');
    } catch {
      setBotStatus('Failed');
    }
    setTimeout(() => setBotStatus(null), 3000);
  }

  if (loading) return <PageLoading />;
  if (error) return <ErrorBanner msg={error} />;
  if (!data) return null;

  const { goals, stats, todayEvents, calendarAuthorized } = data;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, Angel
          </h1>
          <p className="text-jarvis-muted text-sm mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button onClick={triggerBriefing} className="btn-ghost text-xs">
          {botStatus ?? '📨 Send Briefing'}
        </button>
      </div>

      {/* Google Calendar Auth banner */}
      {!calendarAuthorized && (
        <div className="card border-jarvis-accent/40 bg-jarvis-accent/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Connect Google Calendar</p>
            <p className="text-xs text-jarvis-muted mt-0.5">See your events and push time blocks</p>
          </div>
          <button onClick={handleConnectGoogle} className="btn-primary text-xs">
            Connect
          </button>
        </div>
      )}

      {/* Top 3 Priorities */}
      <section>
        <p className="section-title">Top 3 Priorities This Week</p>
        <div className="space-y-2">
          {goals.length > 0 ? goals.map((g, i) => (
            <div key={i} className="card flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-jarvis-accent/20 text-jarvis-accent flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <span className="text-sm text-white">{g}</span>
            </div>
          )) : (
            <div className="card text-center py-6">
              <p className="text-jarvis-muted text-sm">No weekly goals set yet.</p>
              <a href="/planning" className="text-jarvis-accent text-xs mt-1 inline-block hover:underline">
                Set goals in Weekly Planning →
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <p className="section-title">Quick Stats</p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Due This Week"
            value={stats.assignmentsDueSoon}
            icon="📋"
            color="text-jarvis-school"
          />
          <StatCard
            label="Next Post"
            value={stats.nextPostDate ? format(parseISO(stats.nextPostDate), 'MMM d') : '—'}
            icon="📱"
            color="text-jarvis-content"
          />
          <StatCard
            label="Active Clients"
            value={stats.activeClients}
            icon="💼"
            color="text-jarvis-agency"
          />
        </div>
      </section>

      {/* Upcoming Exams */}
      {stats.upcomingExams.length > 0 && (
        <section>
          <p className="section-title">Upcoming Exams</p>
          <div className="space-y-2">
            {stats.upcomingExams.map(exam => {
              const days = exam.dueDate ? differenceInDays(parseISO(exam.dueDate), new Date()) : null;
              const urgencyClass = days !== null && days <= 3 ? 'urgency-critical' : days !== null && days <= 7 ? 'urgency-warning' : 'urgency-ok';
              return (
                <div key={exam.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{exam.assignment}</p>
                    <p className="text-xs text-jarvis-muted">{exam.course}</p>
                  </div>
                  {days !== null && (
                    <span className={`badge ${urgencyClass}`}>
                      {days === 0 ? 'Today!' : days === 1 ? '1 day' : `${days} days`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Today's Calendar */}
      <section>
        <p className="section-title">Today's Calendar</p>
        {!calendarAuthorized ? (
          <div className="card text-center py-6">
            <p className="text-jarvis-muted text-sm">Connect Google Calendar to see events.</p>
          </div>
        ) : todayEvents.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-jarvis-muted text-sm">No events today. Enjoy the focus time!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event, i) => (
              <div key={event.id ?? i} className="card flex items-start gap-3">
                <div className="text-xs text-jarvis-accent font-mono mt-0.5 shrink-0 w-14">
                  {event.isAllDay ? 'All day' : event.start ? format(parseISO(event.start), 'h:mm a') : ''}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{event.title}</p>
                  {event.location && <p className="text-xs text-jarvis-muted">{event.location}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="card text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-jarvis-muted mt-0.5">{label}</div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-jarvis-muted text-sm animate-pulse">Loading Jarvis...</div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="m-6 card border-red-500/30 bg-red-500/10">
      <p className="text-red-400 text-sm font-medium">Error loading dashboard</p>
      <p className="text-jarvis-muted text-xs mt-1">{msg}</p>
    </div>
  );
}
