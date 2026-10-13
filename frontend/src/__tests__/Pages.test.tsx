import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardHomePage from '../app/page';
import IncidentsPage from '../app/incidents/page';
import { incidentsApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  incidentsApi: {
    list: jest.fn(),
  },
}));

jest.mock('../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(),
}));

const mockIncidents = [
  {
    id: 'inc-99',
    serviceId: 'srv-1',
    fingerprint: 'fp99',
    title: 'Payment Gateway Timeout',
    severity: 'CRITICAL',
    state: 'TRIGGERED',
    currentTier: 1,
    alertCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Page Integration Components', () => {
  beforeEach(() => {
    (incidentsApi.list as jest.Mock).mockResolvedValue(mockIncidents);
  });

  it('renders DashboardHomePage with header and KPI stat cards', async () => {
    render(<DashboardHomePage />);
    expect(screen.getByText('Incident Control Center')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Payment Gateway Timeout')).toBeInTheDocument();
    });
  });

  it('renders IncidentsPage with filter toggles and incident list', async () => {
    render(<IncidentsPage />);
    expect(screen.getByText('Incidents')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Payment Gateway Timeout')).toBeInTheDocument();
    });
  });
});
