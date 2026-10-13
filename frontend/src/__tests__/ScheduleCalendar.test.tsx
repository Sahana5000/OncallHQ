import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScheduleCalendar from '../components/ScheduleCalendar';
import { Schedule } from '../types';

const mockSchedule: Schedule = {
  id: 'sch-1',
  serviceId: 'srv-1',
  name: 'API Gateway On-Call',
  timezone: 'UTC',
  layers: [
    {
      id: 'l1',
      scheduleId: 'sch-1',
      userId: 'u1',
      user: { id: 'u1', name: 'Dave Engineer', email: 'dave@oncallhq.com', role: 'RESPONDER' },
      layerPriority: 1,
      timeRange: '[2026-09-01T00:00:00.000Z,2026-10-01T00:00:00.000Z)',
      rotationType: 'DAILY',
    },
  ],
  overrides: [
    {
      id: 'ov1',
      scheduleId: 'sch-1',
      userId: 'u2',
      user: { id: 'u2', name: 'Eva Lead', email: 'eva@oncallhq.com', role: 'LEAD' },
      timeRange: '[2026-09-15T08:00:00.000Z,2026-09-15T16:00:00.000Z)',
      reason: 'Shift Swap',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('ScheduleCalendar Component', () => {
  it('renders schedule name, timezone, layers and overrides', () => {
    render(<ScheduleCalendar schedule={mockSchedule} />);

    expect(screen.getByText('API Gateway On-Call')).toBeInTheDocument();
    expect(screen.getByText('Dave Engineer')).toBeInTheDocument();
    expect(screen.getByText('Eva Lead')).toBeInTheDocument();
    expect(screen.getByText(/Shift Swap/)).toBeInTheDocument();
  });

  it('triggers onAddOverride callback when button is clicked', () => {
    const onAddOverrideMock = jest.fn();
    render(<ScheduleCalendar schedule={mockSchedule} onAddOverride={onAddOverrideMock} />);

    const overrideBtn = screen.getByText('+ Add Override');
    fireEvent.click(overrideBtn);

    expect(onAddOverrideMock).toHaveBeenCalledTimes(1);
  });
});
