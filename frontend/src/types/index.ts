// Shared TypeScript types for the frontend dashboard

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentState =
  | 'TRIGGERED'
  | 'ACKNOWLEDGED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'EXHAUSTED';
export type NotificationChannel = 'EMAIL' | 'WEBHOOK' | 'SMS_MOCK';
export type NotificationStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'LEAD' | 'RESPONDER';
  phoneNumber?: string;
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  ingestionKey: string;
  fallbackUserId?: string;
  fallbackUser?: User;
}

export interface Incident {
  id: string;
  serviceId: string;
  service?: Service;
  fingerprint: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  state: IncidentState;
  assignedUserId?: string;
  assignedUser?: User;
  currentTier: number;
  alertCount: number;
  escalationJobId?: string;
  ackedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Notification {
  id: string;
  incidentId: string;
  userId: string;
  user?: User;
  channel: NotificationChannel;
  status: NotificationStatus;
  errorMessage?: string;
  sentAt: string;
}

export interface Schedule {
  id: string;
  serviceId: string;
  service?: Service;
  name: string;
  timezone: string;
  layers?: ScheduleLayer[];
  overrides?: Override[];
}

export interface ScheduleLayer {
  id: string;
  scheduleId: string;
  userId: string;
  user?: User;
  layerPriority: number;
  timeRange: string;
  rotationType: 'DAILY' | 'WEEKLY' | 'CUSTOM';
}

export interface Override {
  id: string;
  scheduleId: string;
  userId: string;
  user?: User;
  timeRange: string;
  reason?: string;
  createdAt: string;
}

export interface MaintenanceWindow {
  id: string;
  serviceId: string;
  service?: Service;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  createdBy?: string;
  creator?: User;
  createdAt: string;
  updatedAt: string;
}

export interface DurationMetric {
  seconds: number;
  minutes: number;
  hours: number;
  sampleSize: number;
}

export interface AnalyticsOverview {
  totalIncidents: number;
  activeIncidents: number;
  acknowledgedCount: number;
  resolvedCount: number;
  exhaustedCount: number;
  mtta: DurationMetric;
  mttr: DurationMetric;
  severityBreakdown: Record<IncidentSeverity, number>;
  stateBreakdown: Record<IncidentState, number>;
}

export interface ServiceMetric {
  serviceId: string;
  serviceName: string;
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  mtta: DurationMetric;
  mttr: DurationMetric;
}

export interface DailyTrendPoint {
  date: string;
  triggeredCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  avgMttaMinutes: number;
  avgMttrMinutes: number;
}

