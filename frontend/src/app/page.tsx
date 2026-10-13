'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Incident } from '../types';
import { incidentsApi } from '../lib/api';
import { IncidentRow } from '../components/IncidentRow';
import { Spinner, EmptyState, ErrorBanner } from '../components/ui';
import { useWebSocket } from '../hooks/useWebSocket';

const STATS_CONFIG = [
  { key: 'TRIGGERED',    label: 'Triggered',    dot: 'bg-red-500',    color: 'text-red-400' },
  { key: 'ESCALATED',    label: 'Escalated',    dot: 'bg-orange-500', color: 'text-orange-400' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged', dot: 'bg-blue-400',   color: 'text-blue-400' },
  { key: 'RESOLVED',     label: 'Resolved',     dot: 'bg-emerald-400',color: 'text-emerald-400' },
  { key: 'EXHAUSTED',    label: 'Exhausted',    dot: 'bg-gray-500',   color: 'text-gray-400' },
];

export default function DashboardHomePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live'>('connecting');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CRITICAL' | 'ALL'>('ACTIVE');

  const loadIncidents = useCallback(async () => {
    try {
      const data = await incidentsApi.list();
      setIncidents(data);
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
    const interval = setInterval(loadIncidents, 30000);
    return () => clearInterval(interval);
  }, [loadIncidents]);

  useEffect(() => {
    const timer = setTimeout(() => setWsStatus('live'), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleIncidentUpdate = useCallback((updated: Incident) => {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  // Filter logic
  const filteredIncidents = incidents.filter((i) => {
    if (activeTab === 'ACTIVE') {
      return i.state === 'TRIGGERED' || i.state === 'ESCALATED' || i.state === 'ACKNOWLEDGED';
    }
    if (activeTab === 'CRITICAL') {
      return i.severity === 'CRITICAL' && i.state !== 'RESOLVED';
    }
    return true;
  });

  const counts = STATS_CONFIG.reduce(
    (acc, { key }) => {
      acc[key] = incidents.filter((i) => i.state === key).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header / Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-3">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                wsStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'
              }`}
            />
            {wsStatus === 'live' ? 'Real-Time Stream Live' : 'Connecting Stream…'}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Incident Control Center
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            Event-driven alert routing, BullMQ automated escalation & on-call dispatch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadIncidents}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            ↻ Refresh Data
          </button>
          <Link
            href="/incidents"
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            View All Incidents →
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATS_CONFIG.map(({ key, label, dot, color }) => (
          <div
            key={key}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="text-xs text-slate-400 font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{counts[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Active Incidents Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <h2 className="text-base font-bold text-white">Live Incidents Feed</h2>
          </div>
          {/* Quick Tabs */}
          <div className="flex gap-1.5 rounded-lg bg-slate-800/80 p-1 border border-slate-700/60">
            {(['ACTIVE', 'CRITICAL', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab.toLowerCase()}`}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'ACTIVE'
                  ? `Active (${incidents.filter((i) => i.state !== 'RESOLVED').length})`
                  : tab === 'CRITICAL'
                  ? `Critical (${incidents.filter((i) => i.severity === 'CRITICAL' && i.state !== 'RESOLVED').length})`
                  : `All (${incidents.length})`}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={`Failed to load live feed: ${error}`} />}

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden divide-y divide-slate-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No incidents matching criteria"
              description="All systems operating within defined operational thresholds."
            />
          ) : (
            filteredIncidents.slice(0, 10).map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                onUpdate={handleIncidentUpdate}
              />
            ))
          )}
        </div>
      </div>

      {/* System Flow & Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/schedules"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-violet-600/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">📅</span>
            <span className="text-xs text-violet-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              Manage Schedules →
            </span>
          </div>
          <h3 className="font-semibold text-white mb-1">On-Call Schedules & Overrides</h3>
          <p className="text-xs text-slate-400">
            View layer composition, active shifts, and configure postgres range overrides.
          </p>
        </Link>

        <Link
          href="/incidents"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-red-600/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">⚡</span>
            <span className="text-xs text-red-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              Explore Timeline →
            </span>
          </div>
          <h3 className="font-semibold text-white mb-1">Full Incident Audit History</h3>
          <p className="text-xs text-slate-400">
            Inspect incident lifecycle transitions, notification delivery statuses, and audit events.
          </p>
        </Link>
      </div>
    </div>
  );
}
