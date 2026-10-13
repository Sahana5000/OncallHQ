'use client';
import React from 'react';
import { IncidentSeverity, IncidentState } from '../types';

// ─── Severity Badge ───────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40 ring-1 ring-red-500/30',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  LOW:      'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_STYLES[severity] || 'bg-slate-700 text-slate-300'}`}
    >
      {severity}
    </span>
  );
}

// ─── State Badge ──────────────────────────────────────────────────────────────
const STATE_STYLES: Record<IncidentState, string> = {
  TRIGGERED:    'bg-red-900/40 text-red-300 border-red-700/50',
  ACKNOWLEDGED: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  ESCALATED:    'bg-orange-900/40 text-orange-300 border-orange-700/50',
  RESOLVED:     'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  EXHAUSTED:    'bg-slate-800/60 text-slate-400 border-slate-600/50',
};

const STATE_DOTS: Record<IncidentState, string> = {
  TRIGGERED:    'bg-red-500 animate-pulse',
  ACKNOWLEDGED: 'bg-blue-400',
  ESCALATED:    'bg-orange-400 animate-pulse',
  RESOLVED:     'bg-emerald-400',
  EXHAUSTED:    'bg-slate-500',
};

export function StateBadge({ state }: { state: IncidentState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATE_STYLES[state] || 'bg-slate-700 text-slate-300 border-slate-600'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOTS[state]}`} />
      {state}
    </span>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size];
  return (
    <div
      className={`${sizeClass} border-2 border-slate-600 border-t-violet-500 rounded-full animate-spin`}
    />
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-slate-600 text-4xl">{icon}</div>
      <h3 className="text-slate-300 font-semibold">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-xs">{description}</p>}
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
      <span className="mt-0.5 shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Tier Indicator ──────────────────────────────────────────────────────────
export function TierIndicator({ tier, max = 3 }: { tier: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" title={`Escalation Tier ${tier} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-5 rounded-sm transition-colors ${
            i < tier ? 'bg-orange-500' : 'bg-slate-700'
          }`}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1">T{tier}</span>
    </div>
  );
}
