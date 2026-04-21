import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '@/components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders normalized text', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });
});
