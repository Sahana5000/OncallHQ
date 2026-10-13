'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Incident, AuditLog, Notification } from '../../../types';
import { incidentsApi, auditApi, notificationsApi } from '../../../lib/api';
import {
  SeverityBadge,
  StateBadge,
  TierIndicator,
  Spinner,
  ErrorBanner,
} from '../../../components/ui';
import IncidentTimeline from '../../../components/IncidentTimeline';
import { format } from 'date-fns';

const MOCK_USER_ID = 'user-uuid-dashboard-actor';

const CHANNEL_ICONS: Record<string, string> = {
  EMAIL: '📧',
  SMS_MOCK: '📱',
  WEBHOOK: '🔗',
};

const STATUS_STYLES: Record<string, string> = {
  SENT:   'text-emerald-400',
  FAILED: 'text-red-400',
  QUEUED: 'text-yellow-400',
};

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'ack' | 'resolve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [inc, auditLogs, notifs] = await Promise.all([
        incidentsApi.get(id),
        auditApi.getForEntity('INCIDENT', id),
        notificationsApi.forIncident(id),
      ]);
      setIncident(inc);
      setLogs(auditLogs);
      setNotifications(notifs);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledge = useCallback(async () => {
    if (!incident) return;
    setActionLoading('ack');
    setActionError(null);
    try {
      const updated = await incidentsApi.acknowledge(incident.id, MOCK_USER_ID);
      setIncident(updated);
      await load();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [incident, load]);

  const handleResolve = useCallback(async () => {
    if (!incident) return;
    setActionLoading('resolve');
    setActionError(null);
    try {
      const updated = await incidentsApi.resolve(incident.id, MOCK_USER_ID);
      setIncident(updated);
      await load();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [incident, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorBanner message={`Failed to load incident: ${error}`} />
      </div>
    );
  }

  if (!incident) return null;

  const canAck = incident.state === 'TRIGGERED' || incident.state === 'ESCALATED';
  const canResolve = incident.state !== 'RESOLVED' && incident.state !== 'EXHAUSTED';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => router.back()}
        className="text-xs text-slate-500 hover:text-slate-300 mb-5 flex items-center gap-1 transition-colors"
      >
        ← Back to Incidents
      </button>

      {/* Incident Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <SeverityBadge severity={incident.severity} />
              <StateBadge state={incident.state} />
              <TierIndicator tier={incident.currentTier} />
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{incident.title}</h1>
            {incident.description && (
              <p className="text-slate-400 text-sm">{incident.description}</p>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0">
            {canAck && (
              <button
                id="btn-detail-acknowledge"
                onClick={handleAcknowledge}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600/20 text-blue-300 border border-blue-600/40 hover:bg-blue-600/40 disabled:opacity-50 transition-all"
              >
                {actionLoading === 'ack' ? <Spinner size="sm" /> : '✓ Acknowledge'}
              </button>
            )}
            {canResolve && (
              <button
                id="btn-detail-resolve"
                onClick={handleResolve}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/40 disabled:opacity-50 transition-all"
              >
                {actionLoading === 'resolve' ? <Spinner size="sm" /> : '✓ Resolve'}
              </button>
            )}
          </div>
        </div>
        {actionError && <div className="mt-3"><ErrorBanner message={actionError} /></div>}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-500 mb-1">Incident ID</p>
            <p className="text-sm font-mono text-slate-300 truncate" title={incident.id}>
              {incident.id.slice(0, 12)}…
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Service</p>
            <p className="text-sm text-slate-200">{incident.service?.name || incident.serviceId}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Assigned To</p>
            <p className="text-sm text-slate-200">
              {incident.assignedUser?.name || incident.assignedUserId || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Alert Count</p>
            <p className="text-sm text-slate-200">
              <span className={incident.alertCount > 1 ? 'text-orange-400 font-semibold' : ''}>
                {incident.alertCount}
              </span>{' '}
              alert{incident.alertCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Created</p>
            <p className="text-sm text-slate-200">
              {format(new Date(incident.createdAt), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Fingerprint</p>
            <p className="text-xs font-mono text-slate-400 truncate" title={incident.fingerprint}>
              {incident.fingerprint.slice(0, 16)}…
            </p>
          </div>
          {incident.ackedAt && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Acknowledged</p>
              <p className="text-sm text-blue-300">
                {format(new Date(incident.ackedAt), 'MMM d, HH:mm')}
              </p>
            </div>
          )}
          {incident.resolvedAt && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Resolved</p>
              <p className="text-sm text-emerald-300">
                {format(new Date(incident.resolvedAt), 'MMM d, HH:mm')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Timeline — 2/3 width */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Event Timeline</h2>
          <IncidentTimeline logs={logs} />
        </div>

        {/* Notifications — 1/3 width */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Notifications ({notifications.length})
          </h2>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No notifications dispatched yet.
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 px-3 py-2"
                >
                  <span className="text-base shrink-0">
                    {CHANNEL_ICONS[n.channel] || '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium text-slate-300">{n.channel}</p>
                      <span className={`text-xs font-semibold ${STATUS_STYLES[n.status]}`}>
                        {n.status}
                      </span>
                    </div>
                    {n.errorMessage && (
                      <p className="text-xs text-red-400 mt-0.5 truncate" title={n.errorMessage}>
                        {n.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
