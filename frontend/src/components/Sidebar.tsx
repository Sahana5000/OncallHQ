'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/',            label: 'Dashboard',  icon: '⚡' },
  { href: '/incidents',   label: 'Incidents',  icon: '🚨' },
  { href: '/schedules',   label: 'Schedules',  icon: '📅' },
];

export default function Sidebar() {
  const pathname = usePathname();

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

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">v1.0.0 · Phase 6</p>
      </div>
    </aside>
  );
}
