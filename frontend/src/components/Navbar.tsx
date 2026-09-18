import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { BarChart3, Plus, User as UserIcon, LogOut, Radio, Server, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentView: 'explore' | 'dashboard' | 'poll';
  onNavigate: (view: 'explore' | 'dashboard') => void;
  onOpenCreate: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenCreate,
  onOpenAuth,
}) => {
  const { user, logout } = useAuth();
  const [systemHealth, setSystemHealth] = useState<{ status: string; backend: string } | null>(null);
  const [showStatusPopover, setShowStatusPopover] = useState(false);

  useEffect(() => {
    api.checkHealth().then(setSystemHealth).catch(() => null);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            id="brand-logo-btn"
            onClick={() => onNavigate('explore')}
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-semibold text-neutral-900 text-lg tracking-tight flex items-center gap-1.5">
                LivePoll
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Realtime
                </span>
              </span>
            </div>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              id="nav-explore-btn"
              onClick={() => onNavigate('explore')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentView === 'explore'
                  ? 'bg-neutral-100 text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              Public Polls
            </button>

            {user && (
              <button
                id="nav-dashboard-btn"
                onClick={() => onNavigate('dashboard')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  currentView === 'dashboard'
                    ? 'bg-neutral-100 text-neutral-900 font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                My Created Polls
              </button>
            )}
          </nav>
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-3">
          {/* Realtime Engine Status Pill */}
          <div className="relative">
            <button
              id="system-status-indicator-btn"
              onClick={() => setShowStatusPopover(!showStatusPopover)}
              title="System Architecture Status"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Go & Redis Live</span>
            </button>

            {showStatusPopover && (
              <div className="absolute right-0 mt-2 w-72 p-4 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 font-semibold text-neutral-900">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-600" />
                    Stack Status
                  </span>
                  <span className="text-emerald-600 font-bold">Healthy</span>
                </div>
                <div className="mt-2.5 space-y-2 text-neutral-600">
                  <div className="flex items-center justify-between">
                    <span>Backend Engine:</span>
                    <span className="font-mono font-medium text-neutral-900">Go 1.22 + Gin</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database:</span>
                    <span className="font-mono font-medium text-neutral-900">MongoDB 7.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Real-Time Layer:</span>
                    <span className="font-mono font-medium text-neutral-900">Redis 7.2 Pub/Sub</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>WebSocket:</span>
                    <span className="font-mono font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enabled
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowStatusPopover(false)}
                  className="mt-3 w-full py-1 text-center bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-md cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Create Poll Button */}
          <button
            id="nav-create-poll-btn"
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Poll</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* User Auth Section */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-200">
              <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-800">
                <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
                <span className="max-w-[100px] truncate">{user.username}</span>
              </div>
              <button
                id="auth-logout-btn"
                onClick={logout}
                title="Log Out"
                className="p-2 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-200">
              <button
                id="auth-login-trigger-btn"
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="auth-signup-trigger-btn"
                onClick={() => onOpenAuth('signup')}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer border border-indigo-200"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
