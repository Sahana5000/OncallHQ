'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Incident } from '../../types';
import { incidentsApi } from '../../lib/api';
import { IncidentRow } from '../../components/IncidentRow';
import { Spinner, EmptyState, ErrorBanner } from '../../components/ui';
import { useWebSocket } from '../../hooks/useWebSocket';

const STATE_FILTERS = ['ALL', 'TRIGGERED', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED', 'EXHAUSTED'];

const STATS_CONFIG = [
  { key: 'TRIGGERED',    label: 'Triggered',    dot: 'bg-red-500' },
  { key: 'ESCALATED',    label: 'Escalated',    dot: 'bg-orange-500' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged', dot: 'bg-blue-400' },
  { key: 'RESOLVED',     label: 'Resolved',     dot: 'bg-emerald-400' },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const incidentsRef = useRef<Incident[]>([]);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await incidentsApi.list();
      setIncidents(data);
      incidentsRef.current = data;
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdate = useCallback((updated: Incident) => {
    setIncidents((prev) => {
      const exists = prev.find((i) => i.id === updated.id);
      if (exists) {
        return prev.map((i) => (i.id === updated.id ? updated : i));
      }
      return [updated, ...prev];
    });
  }, []);

  useWebSocket(
    useCallback(
      (data: any) => {
        setWsStatus('live');
        if (data?.id) handleUpdate(data as Incident);
      },
      [handleUpdate],
    ),
  );

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 30000); // 30-second poll fallback
    return () => clearInterval(interval);
  }, [loadIncidents]);

  useEffect(() => {
    const timer = setTimeout(() => setWsStatus('live'), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleIncidentUpdate = useCallback((updated: Incident) => {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  const filtered =
    filter === 'ALL' ? incidents : incidents.filter((i) => i.state === filter);

  const counts = STATS_CONFIG.reduce(
    (acc, { key }) => {
      acc[key] = incidents.filter((i) => i.state === key).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Active alerts across all monitored services
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={`h-2 w-2 rounded-full inline-block ${
              wsStatus === 'live' ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'
            }`}
          />
          {wsStatus === 'live' ? 'Live' : 'Connecting…'}
          <button
            onClick={loadIncidents}
            className="ml-3 px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {STATS_CONFIG.map(({ key, label, dot }) => (
          <button
            key={key}
            id={`filter-stat-${key.toLowerCase()}`}
            onClick={() => setFilter(key)}
            className={`rounded-xl border p-4 text-left transition-all hover:border-slate-600 ${
              filter === key
                ? 'bg-slate-800 border-slate-600'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="text-xs text-slate-400 font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{counts[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATE_FILTERS.map((s) => (
          <button
            key={s}
            id={`filter-pill-${s.toLowerCase()}`}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-violet-600/30 text-violet-300 border-violet-600/50'
                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {s}
            {s !== 'ALL' && ` (${incidents.filter((i) => i.state === s).length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {error && <ErrorBanner message={`Failed to load incidents: ${error}`} />}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="No incidents"
            description={
              filter === 'ALL'
                ? 'All systems are operating normally.'
                : `No ${filter.toLowerCase()} incidents.`
            }
          />
        ) : (
          filtered.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onUpdate={handleIncidentUpdate}
            />
          ))
        )}
      </div>
      {filtered.length > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          {filtered.length} incident{filtered.length !== 1 ? 's' : ''} displayed
        </p>
      )}
    </div>
  );
}
