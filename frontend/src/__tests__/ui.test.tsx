import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  SeverityBadge,
  StateBadge,
  TierIndicator,
  Spinner,
  EmptyState,
  ErrorBanner,
} from '../components/ui';

describe('Shared UI Components', () => {
  it('renders SeverityBadge correctly', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders StateBadge with correct label', () => {
    render(<StateBadge state="ACKNOWLEDGED" />);
    expect(screen.getByText('ACKNOWLEDGED')).toBeInTheDocument();
  });

  it('renders TierIndicator correctly', () => {
    render(<TierIndicator tier={2} />);
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('renders EmptyState with custom title and description', () => {
    render(
      <EmptyState
        title="No items found"
        description="Try adjusting your filters."
      />,
    );
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument();
  });

  it('renders ErrorBanner with error message', () => {
    render(<ErrorBanner message="Network connection lost" />);
    expect(screen.getByText('Network connection lost')).toBeInTheDocument();
  });
});
