import { Incident, AuditLog, Notification, Schedule, Override } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// ─── Incidents ────────────────────────────────────────────────────────────────
export const incidentsApi = {
  list: (params?: { serviceId?: string; state?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return apiFetch<Incident[]>(`/api/v1/incidents${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiFetch<Incident>(`/api/v1/incidents/${id}`),
  acknowledge: (id: string, userId: string) =>
    apiFetch<Incident>(`/api/v1/incidents/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  resolve: (id: string, userId?: string) =>
    apiFetch<Incident>(`/api/v1/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditApi = {
  getForEntity: (entityType: string, entityId: string) =>
    apiFetch<AuditLog[]>(`/api/v1/audit/${entityType}/${entityId}`),
};

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  forIncident: (incidentId: string) =>
    apiFetch<Notification[]>(`/api/v1/notifications/incident/${incidentId}`),
};

// ─── Schedules ────────────────────────────────────────────────────────────────
export const schedulesApi = {
  list: () => apiFetch<Schedule[]>('/api/v1/schedules'),
  getForService: (serviceId: string) =>
    apiFetch<Schedule>(`/api/v1/schedules/${serviceId}`),
  getOnCall: (serviceId: string, timestamp?: string) =>
    apiFetch<any>(`/api/v1/schedules/${serviceId}/on-call${timestamp ? `?timestamp=${timestamp}` : ''}`),
  createOverride: (scheduleId: string, body: { userId: string; timeRange: string; reason?: string }) =>
    apiFetch<Override>(`/api/v1/schedules/${scheduleId}/overrides`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
