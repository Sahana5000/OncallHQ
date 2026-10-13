import React from 'react';
import { render, screen } from '@testing-library/react';
import IncidentTimeline from '../components/IncidentTimeline';
import { AuditLog } from '../types';

const mockLogs: AuditLog[] = [
  {
    id: 'log-1',
    orgId: 'org-1',
    actorId: 'system',
    action: 'INCIDENT_TRIGGERED',
    entityType: 'INCIDENT',
    entityId: 'inc-123',
    metadata: { title: 'High Memory Usage', severity: 'HIGH' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'log-2',
    orgId: 'org-1',
    actorId: 'user-456',
    action: 'INCIDENT_ACKNOWLEDGED',
    entityType: 'INCIDENT',
    entityId: 'inc-123',
    metadata: { userId: 'user-456' },
    createdAt: new Date().toISOString(),
  },
];

describe('IncidentTimeline Component', () => {
  it('renders list of audit log events', () => {
    render(<IncidentTimeline logs={mockLogs} />);

    expect(screen.getByText('Incident Triggered')).toBeInTheDocument();
    expect(screen.getByText('Incident Acknowledged')).toBeInTheDocument();
    expect(screen.getByText(/High Memory Usage/)).toBeInTheDocument();
  });

  it('renders empty message when logs array is empty', () => {
    render(<IncidentTimeline logs={[]} />);
    expect(screen.getByText('No audit events recorded yet.')).toBeInTheDocument();
  });
});
