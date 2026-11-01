'use client';
import React, { useEffect, useState } from 'react';
import { analyticsApi, schedulesApi } from '../../lib/api';
import { AnalyticsOverview, ServiceMetric, DailyTrendPoint, Schedule } from '../../types';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [services, setServices] = useState<ServiceMetric[]>([]);
  const [trends, setTrends] = useState<DailyTrendPoint[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      const startDate = sinceDate.toISOString();

      const [overviewData, serviceData, trendData, scheduleList] = await Promise.all([
        analyticsApi.overview({
          serviceId: selectedService || undefined,
          startDate,
        }),
        analyticsApi.services({ startDate }),
        analyticsApi.trends({
          serviceId: selectedService || undefined,
          days,
        }),
        schedulesApi.list().catch(() => []),
      ]);

      setOverview(overviewData);
      setServices(serviceData);
      setTrends(trendData);
      setSchedules(scheduleList);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedService, days]);

  const resolutionRate =
    overview && overview.totalIncidents > 0
      ? Math.round((overview.resolvedCount / overview.totalIncidents) * 100)
      : 0;

  const maxDailyVolume = Math.max(
    1,
    ...trends.map((t) => t.triggeredCount),
  );

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>📊</span> Incident Performance & MTTA / MTTR
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time Site Reliability Engineering operational metrics and incident resolution velocity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Service Filter */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="">All Services</option>
            {schedules.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>
                {s.service?.name || s.name}
              </option>
            ))}
          </select>

          {/* Time Range Pills */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  days === d
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Last {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MTTA Card */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">MTTA (Mean Time to Ack)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {overview?.mtta.sampleSize || 0} acks
            </span>
          </div>
          <div className="text-3xl font-extrabold text-blue-400 tracking-tight">
            {overview ? `${overview.mtta.minutes} min` : '—'}
          </div>
          <p className="text-[11px] text-slate-500">
            Average responder reaction speed from alert trigger to manual acknowledgement.
          </p>
        </div>

        {/* MTTR Card */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">MTTR (Mean Time to Resolve)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {overview?.mttr.sampleSize || 0} resolved
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            {overview ? `${overview.mttr.minutes} min` : '—'}
          </div>
          <p className="text-[11px] text-slate-500">
            Average recovery time from initial alert trigger to full outage resolution.
          </p>
        </div>

        {/* Total & Active Incidents Card */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Total Incidents</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {overview?.activeIncidents || 0} open
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {overview?.totalIncidents ?? '—'}
          </div>
          <p className="text-[11px] text-slate-500">
            {overview?.exhaustedCount || 0} reached max escalation tiers without acknowledgement.
          </p>
        </div>

        {/* Resolution Rate Card */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Resolution Rate</span>
            <span className="text-xs text-slate-400">{overview?.resolvedCount || 0} closed</span>
          </div>
          <div className="text-3xl font-extrabold text-violet-400 tracking-tight">
            {resolutionRate}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-gradient-to-r from-violet-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trend & Volume Chart Section */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">Daily Incident Volume & Resolution</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparison of triggered vs resolved incidents over the selected time window.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-500 inline-block" /> Triggered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500 inline-block" /> Resolved
            </div>
          </div>
        </div>

        {trends.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No incident activity recorded in the past {days} days.
          </div>
        ) : (
          <div className="h-48 flex items-end gap-2 sm:gap-4 pt-6 border-b border-slate-800 pb-2">
            {trends.map((t) => {
              const triggeredPct = Math.round((t.triggeredCount / maxDailyVolume) * 100);
              const resolvedPct = Math.round((t.resolvedCount / maxDailyVolume) * 100);

              return (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    {/* Triggered Bar */}
                    <div
                      style={{ height: `${Math.max(6, triggeredPct)}%` }}
                      className="w-full max-w-[16px] rounded-t bg-rose-500/80 hover:bg-rose-400 transition-all relative"
                      title={`${t.date}: ${t.triggeredCount} triggered`}
                    />
                    {/* Resolved Bar */}
                    <div
                      style={{ height: `${Math.max(6, resolvedPct)}%` }}
                      className="w-full max-w-[16px] rounded-t bg-emerald-500/80 hover:bg-emerald-400 transition-all relative"
                      title={`${t.date}: ${t.resolvedCount} resolved`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 truncate w-full text-center">
                    {t.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Severity Breakdown & Service Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Breakdown Card */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">Severity Breakdown</h2>
          <div className="space-y-3">
            {[
              {
                sev: 'CRITICAL',
                color: 'bg-rose-500',
                count: overview?.severityBreakdown?.CRITICAL || 0,
              },
              {
                sev: 'HIGH',
                color: 'bg-orange-500',
                count: overview?.severityBreakdown?.HIGH || 0,
              },
              {
                sev: 'MEDIUM',
                color: 'bg-amber-500',
                count: overview?.severityBreakdown?.MEDIUM || 0,
              },
              {
                sev: 'LOW',
                color: 'bg-blue-500',
                count: overview?.severityBreakdown?.LOW || 0,
              },
            ].map(({ sev, color, count }) => {
              const total = overview?.totalIncidents || 1;
              const pct = Math.round((count / total) * 100);

              return (
                <div key={sev} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{sev}</span>
                    <span className="text-slate-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${color} h-full rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Service Performance Table */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">Service Breakdown (MTTA & MTTR)</h2>
          {services.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No service analytics recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Total</th>
                    <th className="py-2.5 px-3">Active</th>
                    <th className="py-2.5 px-3">Resolved</th>
                    <th className="py-2.5 px-3">MTTA</th>
                    <th className="py-2.5 px-3">MTTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {services.map((srv) => (
                    <tr key={srv.serviceId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-white">{srv.serviceName}</td>
                      <td className="py-3 px-3">{srv.totalIncidents}</td>
                      <td className="py-3 px-3 text-rose-400 font-medium">{srv.activeIncidents}</td>
                      <td className="py-3 px-3 text-emerald-400 font-medium">{srv.resolvedIncidents}</td>
                      <td className="py-3 px-3 font-mono text-blue-400">
                        {srv.mtta.sampleSize > 0 ? `${srv.mtta.minutes} min` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-400">
                        {srv.mttr.sampleSize > 0 ? `${srv.mttr.minutes} min` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
