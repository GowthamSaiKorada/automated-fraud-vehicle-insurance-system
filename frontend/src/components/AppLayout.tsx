import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Cpu,
  FilePlus2,
  FolderClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AiHealthInfo {
  reachable: boolean;
  cnn_model?: {
    loaded: boolean;
    model_status: string;
  };
}

export default function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiHealth, setAiHealth] = useState<AiHealthInfo | null>(null);

  useEffect(() => {
    if (user?.role !== 'investigator') return;
    apiClient
      .get('/health')
      .then((res) => setAiHealth(res.data?.aiService || null))
      .catch(() => setAiHealth({ reachable: false }));
  }, [user?.role]);

  const isInvestigator = user?.role === 'investigator';

  const navItems = isInvestigator
    ? [
        { to: '/investigator', label: 'Investigator Desk', icon: UserCheck },
        { to: '/claims', label: 'All Claims', icon: FolderClock },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/settings', label: 'Profile & Settings', icon: Settings },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/submit-claim', label: 'Submit Claim', icon: FilePlus2 },
        { to: '/claims', label: 'Claims History', icon: FolderClock },
        { to: '/settings', label: 'Profile & Settings', icon: Settings },
      ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0B1E3D] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">VeriClaim AI</div>
            <div className="text-[11px] font-medium text-sky-200/75">Fraud Verification</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <div className="text-xs font-medium text-sky-200/70">Signed in as</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-white">{user?.name}</div>
          <span className="mt-1.5 inline-flex items-center rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200">
            {isInvestigator ? 'Insurance Investigator' : 'Customer'}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-900/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 space-y-3">
        {isInvestigator && (
          <div className="rounded-xl bg-[#102952] px-3 py-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-sky-200">
              <Cpu className="h-3.5 w-3.5" />
              AI Engine Status
            </div>
            {aiHealth === null ? (
              <div className="mt-1 text-slate-400">Checking FastAPI...</div>
            ) : !aiHealth.reachable ? (
              <div className="mt-1 text-rose-300">AI Service Offline</div>
            ) : aiHealth.cnn_model?.loaded ? (
              <div className="mt-1 text-emerald-300">Trained CNN Active</div>
            ) : (
              <div className="mt-1 text-amber-300">Demo Mode (No CNN Weights)</div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{renderSidebarContent()}</aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-64 max-w-[80vw]">{renderSidebarContent()}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0B1E3D] sm:text-2xl">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
