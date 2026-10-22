import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⚡', exact: true },
  { to: '/school', label: 'School', icon: '📚' },
  { to: '/content', label: 'Content', icon: '🎬' },
  { to: '/agency', label: 'Agency', icon: '💼' },
  { to: '/planning', label: 'Weekly Plan', icon: '🗓️' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-jarvis-surface border-r border-jarvis-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-jarvis-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-jarvis-accent flex items-center justify-center text-sm font-bold">J</div>
          <span className="font-semibold text-white tracking-tight">Jarvis</span>
        </div>
        <p className="text-[10px] text-jarvis-muted mt-1 tracking-wide uppercase">Productivity Hub</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-jarvis-accent/15 text-jarvis-accent'
                  : 'text-jarvis-muted hover:text-white hover:bg-jarvis-border/50'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-jarvis-border">
        <p className="text-[10px] text-jarvis-muted text-center">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </aside>
  );
}
