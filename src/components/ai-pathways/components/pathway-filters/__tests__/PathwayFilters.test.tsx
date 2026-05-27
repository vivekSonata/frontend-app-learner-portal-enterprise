import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PathwayFilters } from '../PathwayFilters';

describe('PathwayFilters', () => {
  const mockProps = {
    searchQuery: '',
    statusFilter: 'all' as const,
    levelFilter: 'all',
    sortKey: 'order' as const,
    sortOrder: 'asc' as const,
    onSearchChange: jest.fn(),
    onStatusChange: jest.fn(),
    onLevelChange: jest.fn(),
    onSortKeyChange: jest.fn(),
    onSortOrderChange: jest.fn(),
    onReset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and calls handlers', () => {
    render(<PathwayFilters {...mockProps} />);

    // Search change
    const searchInput = screen.getByLabelText('Search Courses');
    fireEvent.change(searchInput, { target: { value: 'react' } });
    expect(mockProps.onSearchChange).toHaveBeenCalledWith('react');

    // Status change
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });
    expect(mockProps.onStatusChange).toHaveBeenCalledWith('completed');

    // Level change
    const levelSelect = screen.getByLabelText('Level');
    fireEvent.change(levelSelect, { target: { value: 'Advanced' } });
    expect(mockProps.onLevelChange).toHaveBeenCalledWith('Advanced');

    // Sort change
    const sortSelect = screen.getByLabelText('Sort By');
    fireEvent.change(sortSelect, { target: { value: 'title-desc' } });
    expect(mockProps.onSortKeyChange).toHaveBeenCalledWith('title');
    expect(mockProps.onSortOrderChange).toHaveBeenCalledWith('desc');

    // Reset
    const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
    fireEvent.click(resetBtn);
    expect(mockProps.onReset).toHaveBeenCalledTimes(1);
  });
});
