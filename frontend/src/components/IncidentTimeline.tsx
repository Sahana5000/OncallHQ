'use client';
import React from 'react';
import { AuditLog } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  INCIDENT_TRIGGERED:    { icon: '🔴', color: 'text-red-400 border-red-800' },
  INCIDENT_ACKNOWLEDGED: { icon: '✅', color: 'text-blue-400 border-blue-800' },
  INCIDENT_ESCALATED:    { icon: '⬆️', color: 'text-orange-400 border-orange-800' },
  INCIDENT_RESOLVED:     { icon: '🟢', color: 'text-emerald-400 border-emerald-800' },
  INCIDENT_EXHAUSTED:    { icon: '⛔', color: 'text-slate-400 border-slate-700' },
  ALERT_DEDUPLICATED:    { icon: '🔁', color: 'text-yellow-400 border-yellow-800' },
  NOTIFICATION_SENT:     { icon: '📨', color: 'text-violet-400 border-violet-800' },
  NOTIFICATION_FAILED:   { icon: '❌', color: 'text-red-400 border-red-800' },
};

function humanizeAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TimelineProps {
  logs: AuditLog[];
  loading?: boolean;
}

export default function IncidentTimeline({ logs, loading }: TimelineProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-1.5 py-1">
              <div className="h-3 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm">
        No audit events recorded yet.
      </div>
    );
  }

  return (
    <ol className="relative ml-3 border-l border-slate-800">
      {logs.map((log, i) => {
        const style = ACTION_ICONS[log.action] || { icon: '📋', color: 'text-slate-400 border-slate-700' };
        return (
          <li key={log.id} className="mb-6 ml-5 last:mb-0">
            {/* Icon dot */}
            <span
              className={`absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border ${style.color} text-sm`}
            >
              {style.icon}
            </span>
            <div className="ml-1">
              <p className={`text-sm font-semibold ${style.color.split(' ')[0]}`}>
                {humanizeAction(log.action)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                by <span className="text-slate-400">{log.actorId}</span>
                {' · '}
                <time
                  dateTime={log.createdAt}
                  title={format(new Date(log.createdAt), 'PPpp')}
                >
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </time>
              </p>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400">
                    View metadata
                  </summary>
                  <pre className="mt-1 text-xs bg-slate-900 border border-slate-800 rounded p-2 overflow-x-auto text-slate-400">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
