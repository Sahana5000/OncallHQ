'use client';
import React from 'react';
import { Schedule, Override } from '../types';
import { format, parseISO } from 'date-fns';

function parseRange(range: string): { start: Date; end: Date } | null {
  try {
    const match = range.match(/[\[\(]"?([^",\s]+)"?\s*,\s*"?([^",\s]+)"?[\]\)]/);
    if (match) {
      return { start: parseISO(match[1]), end: parseISO(match[2]) };
    }
  } catch {}
  return null;
}

const ROTATION_COLORS = [
  'bg-violet-500/20 border-violet-600/40 text-violet-300',
  'bg-blue-500/20 border-blue-600/40 text-blue-300',
  'bg-emerald-500/20 border-emerald-600/40 text-emerald-300',
  'bg-amber-500/20 border-amber-600/40 text-amber-300',
];

interface ScheduleCalendarProps {
  schedule: Schedule;
  onAddOverride?: () => void;
}

export default function ScheduleCalendar({ schedule, onAddOverride }: ScheduleCalendarProps) {
  return (
    <div className="space-y-5">
      {/* Schedule Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">{schedule.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Timezone: {schedule.timezone}</p>
        </div>
        {onAddOverride && (
          <button
            id="btn-add-override"
            onClick={onAddOverride}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-violet-600/20 text-violet-300 border border-violet-600/40 hover:bg-violet-600/40 transition-colors"
          >
            + Add Override
          </button>
        )}
      </div>

      {/* Active Overrides */}
      {schedule.overrides && schedule.overrides.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Active Overrides
          </h4>
          <div className="space-y-2">
            {schedule.overrides.map((override) => {
              const range = parseRange(override.timeRange);
              return (
                <div
                  key={override.id}
                  className="flex items-start gap-3 rounded-lg bg-amber-900/20 border border-amber-700/40 px-3 py-2.5"
                >
                  <span className="text-amber-400 text-base mt-0.5">📌</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-200">
                      {override.user?.name || override.userId}
                    </p>
                    {range && (
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        {format(range.start, 'MMM d, HH:mm')} →{' '}
                        {format(range.end, 'MMM d, HH:mm')}
                      </p>
                    )}
                    {override.reason && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        &ldquo;{override.reason}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rotation Layers */}
      {schedule.layers && schedule.layers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Rotation Layers
          </h4>
          <div className="space-y-2">
            {[...schedule.layers]
              .sort((a, b) => a.layerPriority - b.layerPriority)
              .map((layer, i) => {
                const range = parseRange(layer.timeRange);
                const colorClass = ROTATION_COLORS[i % ROTATION_COLORS.length];
                return (
                  <div
                    key={layer.id}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${colorClass}`}
                  >
                    <span className="text-sm font-bold opacity-70 mt-0.5">
                      P{layer.layerPriority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {layer.user?.name || layer.userId}
                        </p>
                        <span className="text-xs opacity-70 shrink-0">
                          {layer.rotationType}
                        </span>
                      </div>
                      {range && (
                        <p className="text-xs opacity-60 mt-0.5">
                          {format(range.start, 'MMM d')} → {format(range.end, 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {(!schedule.layers || schedule.layers.length === 0) &&
        (!schedule.overrides || schedule.overrides.length === 0) && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No layers or overrides configured for this schedule.
          </div>
        )}
    </div>
  );
}
