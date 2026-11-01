'use client';
import React, { useEffect, useState } from 'react';
import { maintenanceApi, schedulesApi, getCurrentUser } from '../../lib/api';
import { MaintenanceWindow, Schedule, User } from '../../types';

export default function MaintenancePage() {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [serviceId, setServiceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [winList, schedList] = await Promise.all([
        maintenanceApi.list(),
        schedulesApi.list().catch(() => []),
      ]);
      setWindows(winList);
      setSchedules(schedList);
      if (schedList.length > 0 && !serviceId) {
        setServiceId(schedList[0].serviceId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load maintenance windows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadData();
  }, []);

  const handleCreateWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await maintenanceApi.create({
        serviceId,
        name,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setModalOpen(false);
      setName('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create maintenance window');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWindow = async (id: string) => {
    if (!confirm('Are you sure you want to remove this maintenance window?')) return;
    try {
      await maintenanceApi.delete(id);
      setWindows((prev) => prev.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(`Error deleting window: ${err.message}`);
    }
  };

  const now = new Date();
  const activeWindows = windows.filter(
    (w) => new Date(w.startTime) <= now && new Date(w.endTime) >= now,
  );
  const upcomingWindows = windows.filter((w) => new Date(w.startTime) > now);
  const pastWindows = windows.filter((w) => new Date(w.endTime) < now);

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEAD';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>🛠️</span> Maintenance Windows
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scheduled maintenance suppresses alert noise and prevents spurious on-call escalations.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              // Prepopulate start = now, end = now + 1 hour
              const start = new Date();
              const end = new Date(start.getTime() + 60 * 60 * 1000);
              setStartTime(start.toISOString().slice(0, 16));
              setEndTime(end.toISOString().slice(0, 16));
              setModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors shadow-lg shadow-violet-900/40 flex items-center gap-2 self-start sm:self-auto"
          >
            <span>➕</span> New Maintenance Window
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Active Maintenance Notice */}
      {activeWindows.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
            Active Maintenance in Progress ({activeWindows.length})
          </div>
          <p className="text-xs text-amber-200/80">
            Incoming alerts for services under maintenance are automatically suppressed from paging on-call engineers.
            Full records are retained in the audit log.
          </p>
        </div>
      )}

      {/* Active Windows Section */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
          Active Windows
        </h2>
        {activeWindows.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-sm text-slate-500">
            No services currently in active maintenance.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeWindows.map((win) => (
              <div
                key={win.id}
                className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wide">
                      Active
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{win.name}</h3>
                    <p className="text-xs text-slate-400">{win.service?.name || win.serviceId}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteWindow(win.id)}
                      className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                      title="End/Delete Window"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {win.description && (
                  <p className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                    {win.description}
                  </p>
                )}
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex justify-between">
                  <span>Start: {new Date(win.startTime).toLocaleString()}</span>
                  <span>Ends: {new Date(win.endTime).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Windows Section */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
          Upcoming Scheduled Windows ({upcomingWindows.length})
        </h2>
        {upcomingWindows.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-sm text-slate-500">
            No upcoming maintenance scheduled.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingWindows.map((win) => (
              <div
                key={win.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wide">
                      Scheduled
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{win.name}</h3>
                    <p className="text-xs text-slate-400">{win.service?.name || win.serviceId}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteWindow(win.id)}
                      className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {win.description && (
                  <p className="text-xs text-slate-300">{win.description}</p>
                )}
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                  <span>Starts: {new Date(win.startTime).toLocaleString()}</span>
                  <span>Ends: {new Date(win.endTime).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Windows Section */}
      {pastWindows.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-base font-semibold text-slate-400">Past Windows ({pastWindows.length})</h2>
          <div className="space-y-2">
            {pastWindows.slice(0, 5).map((win) => (
              <div
                key={win.id}
                className="px-4 py-3 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400"
              >
                <div>
                  <span className="text-slate-300 font-medium">{win.name}</span>
                  <span className="text-slate-500 ml-2">({win.service?.name || win.serviceId})</span>
                </div>
                <div>Ended {new Date(win.endTime).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Create Maintenance Window</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWindow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Affected Service
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-violet-500 text-sm"
                >
                  {schedules.map((s) => (
                    <option key={s.serviceId} value={s.serviceId}>
                      {s.service?.name || s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Window Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Core DB Failover / Network Maintenance"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Description / Reason
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Reason for maintenance and expected impact"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-violet-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-violet-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
                >
                  {submitting ? 'Creating...' : 'Schedule Window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
