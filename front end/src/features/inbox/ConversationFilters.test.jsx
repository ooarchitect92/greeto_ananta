import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationFilters from './ConversationFilters.jsx';

describe('ConversationFilters', () => {
  it('shows dynamic counts and reports the selected filter', () => {
    const onSelectFilter = vi.fn();
    render(
      <ConversationFilters
        activeFilter="open"
        onSelectFilter={onSelectFilter}
        counts={{ open: 12, unassigned: 3, resolved: 0 }}
      />,
    );

    expect(screen.getByRole('button', { name: /open\s*12/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unassigned\s*3/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resolved$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /unassigned\s*3/i }));
    expect(onSelectFilter).toHaveBeenCalledWith('unassigned');
  });
});
