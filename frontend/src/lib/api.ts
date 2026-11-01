import {
  Incident,
  AuditLog,
  Notification,
  Schedule,
  Override,
  MaintenanceWindow,
  AnalyticsOverview,
  ServiceMetric,
  DailyTrendPoint,
  User,
} from '../types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/v1\/?$/, '');

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('oncall_token');
  }
  return null;
}

export function setAuthSession(token: string, user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('oncall_token', token);
    localStorage.setItem('oncall_user', JSON.stringify(user));
  }
}

export function clearAuthSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('oncall_token');
    localStorage.removeItem('oncall_user');
  }
}

export function getCurrentUser(): User | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('oncall_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// ─── Authentication ──────────────────────────────────────────────────────────
export const authApi = {
  register: (body: {
    email: string;
    name: string;
    password: string;
    role?: 'ADMIN' | 'LEAD' | 'RESPONDER';
    phoneNumber?: string;
  }) =>
    apiFetch<{ user: User; accessToken: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    apiFetch<{ user: User; accessToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getMe: () => apiFetch<User>('/api/v1/auth/me'),
};

// ─── Incidents ────────────────────────────────────────────────────────────────
export const incidentsApi = {
  list: (params?: { serviceId?: string; state?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString();
    return apiFetch<Incident[]>(`/api/v1/incidents${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiFetch<Incident>(`/api/v1/incidents/${id}`),
  acknowledge: (id: string, userId?: string) =>
    apiFetch<Incident>(`/api/v1/incidents/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(userId ? { userId } : {}),
    }),
  resolve: (id: string, userId?: string) =>
    apiFetch<Incident>(`/api/v1/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(userId ? { userId } : {}),
    }),
};

// ─── Maintenance Windows ───────────────────────────────────────────────────────
export const maintenanceApi = {
  list: (serviceId?: string) =>
    apiFetch<MaintenanceWindow[]>(
      `/api/v1/maintenance${serviceId ? `?serviceId=${serviceId}` : ''}`,
    ),
  get: (id: string) => apiFetch<MaintenanceWindow>(`/api/v1/maintenance/${id}`),
  create: (body: {
    serviceId: string;
    name: string;
    description?: string;
    startTime: string;
    endTime: string;
  }) =>
    apiFetch<MaintenanceWindow>('/api/v1/maintenance', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: {
      name?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
    },
  ) =>
    apiFetch<MaintenanceWindow>(`/api/v1/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/api/v1/maintenance/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (params?: { serviceId?: string; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return apiFetch<AnalyticsOverview>(`/api/v1/analytics/overview${qs ? `?${qs}` : ''}`);
  },
  services: (params?: { startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return apiFetch<ServiceMetric[]>(`/api/v1/analytics/services${qs ? `?${qs}` : ''}`);
  },
  trends: (params?: { serviceId?: string; days?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return apiFetch<DailyTrendPoint[]>(`/api/v1/analytics/trends${qs ? `?${qs}` : ''}`);
  },
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

