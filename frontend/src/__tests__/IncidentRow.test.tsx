import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncidentRow } from '../components/IncidentRow';
import { Incident } from '../types';
import { incidentsApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  incidentsApi: {
    acknowledge: jest.fn(),
    resolve: jest.fn(),
  },
}));

const mockIncident: Incident = {
  id: 'inc-123',
  serviceId: 'srv-456',
  service: { id: 'srv-456', orgId: 'org-1', name: 'Database Cluster', ingestionKey: 'key' },
  fingerprint: 'fp-sha256-hash',
  title: 'High CPU Utilization on db-primary',
  description: 'CPU threshold exceeded 95% for 5 consecutive minutes',
  severity: 'CRITICAL',
  state: 'TRIGGERED',
  currentTier: 1,
  alertCount: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('IncidentRow Component', () => {
  it('renders incident details correctly', () => {
    render(<IncidentRow incident={mockIncident} onUpdate={jest.fn()} />);

    expect(screen.getByText('High CPU Utilization on db-primary')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('TRIGGERED')).toBeInTheDocument();
    expect(screen.getByText('Database Cluster')).toBeInTheDocument();
    expect(screen.getByText('3 alerts')).toBeInTheDocument();
  });

  it('handles Acknowledge button click', async () => {
    const onUpdateMock = jest.fn();
    const ackIncident = { ...mockIncident, state: 'ACKNOWLEDGED' as const };
    (incidentsApi.acknowledge as jest.Mock).mockResolvedValue(ackIncident);

    render(<IncidentRow incident={mockIncident} onUpdate={onUpdateMock} />);

    const ackButton = screen.getByText('Acknowledge');
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(incidentsApi.acknowledge).toHaveBeenCalledWith('inc-123', expect.any(String));
      expect(onUpdateMock).toHaveBeenCalledWith(ackIncident);
    });
  });

  it('handles Resolve button click', async () => {
    const onUpdateMock = jest.fn();
    const resIncident = { ...mockIncident, state: 'RESOLVED' as const };
    (incidentsApi.resolve as jest.Mock).mockResolvedValue(resIncident);

    render(<IncidentRow incident={mockIncident} onUpdate={onUpdateMock} />);

    const resButton = screen.getByText('Resolve');
    fireEvent.click(resButton);

    await waitFor(() => {
      expect(incidentsApi.resolve).toHaveBeenCalledWith('inc-123', expect.any(String));
      expect(onUpdateMock).toHaveBeenCalledWith(resIncident);
    });
  });
});
