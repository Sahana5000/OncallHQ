'use client';
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Incident } from '../types';
import { SeverityBadge, StateBadge, TierIndicator } from './ui';
import { incidentsApi } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

interface IncidentRowProps {
  incident: Incident;
  onUpdate: (updated: Incident) => void;
}

const MOCK_USER_ID = 'user-uuid-dashboard-actor';

export function IncidentRow({ incident, onUpdate }: IncidentRowProps) {
  const [loading, setLoading] = useState<'ack' | 'resolve' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAcknowledge = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading('ack');
    setError(null);
    try {
      const updated = await incidentsApi.acknowledge(incident.id, MOCK_USER_ID);
      onUpdate(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }, [incident.id, onUpdate]);

  const handleResolve = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading('resolve');
    setError(null);
    try {
      const updated = await incidentsApi.resolve(incident.id, MOCK_USER_ID);
      onUpdate(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }, [incident.id, onUpdate]);

  const canAck = incident.state === 'TRIGGERED' || incident.state === 'ESCALATED';
  const canResolve = incident.state !== 'RESOLVED' && incident.state !== 'EXHAUSTED';

  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="block hover:bg-slate-800/50 transition-colors border-b border-slate-800/60 last:border-0"
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <SeverityBadge severity={incident.severity} />
              <StateBadge state={incident.state} />
              {incident.currentTier > 1 && (
                <TierIndicator tier={incident.currentTier} />
              )}
            </div>
            <p className="text-sm font-semibold text-slate-100 truncate">
              {incident.title}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span title={incident.id}>#{incident.id.slice(0, 8)}</span>
              <span>·</span>
              <span>{incident.service?.name || incident.serviceId}</span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}</span>
              {incident.alertCount > 1 && (
                <>
                  <span>·</span>
                  <span className="text-orange-400 font-medium">{incident.alertCount} alerts</span>
                </>
              )}
            </div>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.preventDefault()}>
            {canAck && (
              <button
                id={`btn-ack-${incident.id}`}
                onClick={handleAcknowledge}
                disabled={loading !== null}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600/20 text-blue-300 border border-blue-600/40 hover:bg-blue-600/40 disabled:opacity-50 transition-colors"
              >
                {loading === 'ack' ? '...' : 'Acknowledge'}
              </button>
            )}
            {canResolve && (
              <button
                id={`btn-resolve-${incident.id}`}
                onClick={handleResolve}
                disabled={loading !== null}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/40 disabled:opacity-50 transition-colors"
              >
                {loading === 'resolve' ? '...' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
