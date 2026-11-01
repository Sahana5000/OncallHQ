import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '../app/analytics/page';
import MaintenancePage from '../app/maintenance/page';
import LoginPage from '../app/login/page';
import RegisterPage from '../app/register/page';
import { analyticsApi, maintenanceApi, schedulesApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  analyticsApi: {
    overview: jest.fn(),
    services: jest.fn(),
    trends: jest.fn(),
  },
  maintenanceApi: {
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  schedulesApi: {
    list: jest.fn(),
  },
  getCurrentUser: jest.fn().mockReturnValue({
    id: 'user-admin',
    name: 'Admin User',
    role: 'ADMIN',
  }),
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
  },
  setAuthSession: jest.fn(),
  clearAuthSession: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/',
}));

describe('New Features Frontend Test Suite', () => {
  beforeEach(() => {
    (analyticsApi.overview as jest.Mock).mockResolvedValue({
      totalIncidents: 12,
      activeIncidents: 3,
      acknowledgedCount: 9,
      resolvedCount: 8,
      exhaustedCount: 1,
      mtta: { seconds: 540, minutes: 9.0, hours: 0.15, sampleSize: 9 },
      mttr: { seconds: 2160, minutes: 36.0, hours: 0.6, sampleSize: 8 },
      severityBreakdown: {
        CRITICAL: 4,
        HIGH: 5,
        MEDIUM: 2,
        LOW: 1,
      },
      stateBreakdown: {
        TRIGGERED: 1,
        ACKNOWLEDGED: 2,
        ESCALATED: 0,
        RESOLVED: 8,
        EXHAUSTED: 1,
      },
    });

    (analyticsApi.services as jest.Mock).mockResolvedValue([
      {
        serviceId: 'srv-1',
        serviceName: 'Core Payment API',
        totalIncidents: 8,
        activeIncidents: 1,
        resolvedIncidents: 7,
        mtta: { seconds: 480, minutes: 8.0, hours: 0.13, sampleSize: 7 },
        mttr: { seconds: 1800, minutes: 30.0, hours: 0.5, sampleSize: 7 },
      },
    ]);

    (analyticsApi.trends as jest.Mock).mockResolvedValue([
      {
        date: '2026-11-01',
        triggeredCount: 4,
        acknowledgedCount: 4,
        resolvedCount: 3,
        avgMttaMinutes: 8.5,
        avgMttrMinutes: 32.0,
      },
    ]);

    (maintenanceApi.list as jest.Mock).mockResolvedValue([
      {
        id: 'win-1',
        serviceId: 'srv-1',
        name: 'Database Failover Testing',
        description: 'Simulating replica promotion',
        startTime: new Date(Date.now() - 100000).toISOString(),
        endTime: new Date(Date.now() + 500000).toISOString(),
        service: { name: 'Core Payment API' },
      },
    ]);

    (schedulesApi.list as jest.Mock).mockResolvedValue([
      {
        id: 'sch-1',
        serviceId: 'srv-1',
        name: 'Payment Tier Rotation',
      },
    ]);
  });

  it('renders AnalyticsPage with calculated MTTA, MTTR, and severity breakdown', async () => {
    render(<AnalyticsPage />);
    expect(
      screen.getByText(/Incident Performance & MTTA \/ MTTR/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('9 min')).toBeInTheDocument(); // MTTA
      expect(screen.getByText('36 min')).toBeInTheDocument(); // MTTR
      expect(screen.getByText('Core Payment API')).toBeInTheDocument();
    });
  });

  it('renders MaintenancePage with active windows and allows scheduling', async () => {
    render(<MaintenancePage />);
    expect(screen.getByText('Maintenance Windows')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Database Failover Testing')).toBeInTheDocument();
      expect(
        screen.getByText(/Active Maintenance in Progress/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /New Maintenance Window/i }),
      ).toBeInTheDocument();
    });
  });

  it('renders LoginPage with email, password inputs, and sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in to OnCallHQ')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('responder@oncallhq.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('renders RegisterPage with role selector and inputs', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Create an Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });
});
