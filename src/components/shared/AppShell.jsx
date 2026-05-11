import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USE_MOCK } from '../../authConfig';

const PLANNER_NAV = [
  { to: '/planner/upload',    icon: '↑', label: 'Upload Data' },
  { to: '/planner/edit',      icon: '✎', label: 'Edit by Month' },
  { to: '/planner/dashboard', icon: '◱', label: 'My Dashboard' },
  { to: '/planner/submit',    icon: '✓', label: 'Submit Plan' },
];

const MANAGER_NAV = [
  { to: '/manager',          icon: '⊞', label: 'LATAM Consolidated' },
  { to: '/manager/overhead', icon: '△', label: 'Overhead Analysis' },
];

const BREADCRUMBS = {
  '/planner/upload':    'Upload Data',
  '/planner/edit':      'Edit by Month',
  '/planner/dashboard': 'My Dashboard',
  '/planner/submit':    'Submit Plan',
  '/manager':           'LATAM Consolidated',
  '/manager/overhead':  'Overhead Analysis',
};

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <span className="w-4 text-center opacity-80">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { user, role, signOut, sheetsStatus } = useAuth();
  const location = useLocation();
  const navLinks = (role === 'Manager' || role === 'Exec') ? MANAGER_NAV : PLANNER_NAV;
  const breadcrumb = BREADCRUMBS[location.pathname] ?? 'WFM Cap Plan';

  const initials = user?.name
    ?.split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="font-bold text-white text-base tracking-tight">WFM Cap Plan</span>
          <p className="text-xs text-gray-500 mt-0.5">LATAM · Concentrix</p>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-3">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              role === 'Manager' ? 'bg-blue-800 text-blue-200' : 'bg-gray-700 text-gray-300'
            }`}>
              {role}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navLinks.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-800 flex flex-col gap-2">
          {/* Data source badge — Fix 5: colour reflects actual Sheets connectivity */}
          {USE_MOCK ? (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-amber-900 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Mock mode
            </div>
          ) : sheetsStatus === null ? (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-gray-800 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
              Connecting…
            </div>
          ) : sheetsStatus.ok ? (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-green-900 text-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live · Google Sheets
            </div>
          ) : (
            <div className="relative group flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-red-900 text-red-300 cursor-help">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Sheets error
              <div className="absolute bottom-full left-0 mb-1.5 w-64 bg-gray-950 text-red-300 text-xs rounded p-2 shadow-lg hidden group-hover:block z-50 leading-relaxed">
                {sheetsStatus.error || 'Could not reach Google Sheets'}
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full text-xs text-gray-500 hover:text-red-400 text-left px-1 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>WFM Cap Plan</span>
            <span>/</span>
            <span className="font-semibold text-gray-800">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
              Apr 2026 – Mar 2027
            </span>
            {USE_MOCK && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded font-medium">
                Mock mode — SharePoint not connected
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
