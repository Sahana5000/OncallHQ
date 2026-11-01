'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, clearAuthSession } from '../lib/api';
import { User } from '../types';

const navLinks = [
  { href: '/',            label: 'Dashboard',   icon: '⚡' },
  { href: '/incidents',   label: 'Incidents',   icon: '🚨' },
  { href: '/schedules',   label: 'Schedules',   icon: '📅' },
  { href: '/maintenance', label: 'Maintenance', icon: '🛠️' },
  { href: '/analytics',   label: 'Analytics',   icon: '📊' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    router.push('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-slate-950 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-900/50">
          HQ
        </div>
        <span className="font-bold text-white tracking-tight">OnCallHQ</span>
        <span className="ml-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" title="System Live" />
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navLinks.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User Section & Footer */}
      <div className="px-4 py-4 border-t border-slate-800 space-y-3">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-900/50 text-violet-300 border border-violet-700/50">
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-xs text-rose-400 hover:text-rose-300 transition-colors py-1 flex items-center gap-1.5"
            >
              <span>🚪</span> Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Link
              href="/login"
              className="block w-full text-center py-1.5 px-3 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}
        <p className="text-[10px] text-slate-600 text-center">OnCallHQ Platform v1.2.0</p>
      </div>
    </aside>
  );
}
