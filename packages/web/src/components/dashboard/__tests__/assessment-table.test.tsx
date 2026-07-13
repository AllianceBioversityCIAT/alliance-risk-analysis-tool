import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentTable } from '../assessment-table';

jest.mock('@/components/shared/avatar-initials', () => ({
  AvatarInitials: ({ name }: { name: string }) => <div data-testid="avatar-initials">{name}</div>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}%</div>,
}));

describe('AssessmentTable', () => {
  const mockAssessments = [
    {
      id: '1',
      name: 'Alpha Project',
      companyName: 'Alpha Corp',
      updatedAt: '2023-10-01T10:00:00Z',
      progress: 50,
      status: 'DRAFT',
    },
    {
      id: '2',
      name: 'Beta Project',
      companyName: 'Beta LLC',
      updatedAt: '2023-10-05T10:00:00Z',
      progress: 90,
      status: 'COMPLETE',
    },
    {
      id: '3',
      name: 'Gamma Project',
      companyName: 'Gamma Inc',
      updatedAt: '2023-10-03T10:00:00Z',
      progress: 10,
      status: 'ANALYZING',
    },
  ];

  const defaultProps = {
    assessments: mockAssessments as any,
    total: 3,
    currentPage: 1,
    pageSize: 10,
    hasNextPage: false,
    hasPrevPage: false,
    onNextPage: jest.fn(),
    onPrevPage: jest.fn(),
    onView: jest.fn(),
    onDelete: jest.fn(),
    onResume: jest.fn(),
  };

  it('renders correctly with given assessments', () => {
    render(<AssessmentTable {...defaultProps} />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.getByText('Gamma Project')).toBeInTheDocument();
  });

  it('renders status filter pills if onStatusFilter is provided', () => {
    const onStatusFilterMock = jest.fn();
    render(<AssessmentTable {...defaultProps} onStatusFilter={onStatusFilterMock} activeStatus="DRAFT" />);
    
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analyzing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Complete')[0]);
    expect(onStatusFilterMock).toHaveBeenCalledWith('COMPLETE');
  });

  it('sorts assessments by Progress when progress header is clicked', async () => {
    render(<AssessmentTable {...defaultProps} />);
    
    // Initial order should be just the order given (Alpha, Beta, Gamma)
    const rowsInitial = screen.getAllByRole('row');
    // First row is header, so rowsInitial[1] is first data row
    expect(rowsInitial[1]).toHaveTextContent('Alpha Project');

    const progressHeader = screen.getByText('Progress');
    
    // Click once -> sort ascending
    await userEvent.click(progressHeader);
    const rowsAsc = screen.getAllByRole('row');
    expect(rowsAsc[1]).toHaveTextContent('Gamma Project'); // 10%
    expect(rowsAsc[2]).toHaveTextContent('Alpha Project'); // 50%
    expect(rowsAsc[3]).toHaveTextContent('Beta Project'); // 90%

    // Click again -> sort descending
    await userEvent.click(progressHeader);
    const rowsDesc = screen.getAllByRole('row');
    expect(rowsDesc[1]).toHaveTextContent('Beta Project'); // 90%
    expect(rowsDesc[2]).toHaveTextContent('Alpha Project'); // 50%
    expect(rowsDesc[3]).toHaveTextContent('Gamma Project'); // 10%
  });

  it('shows empty state when no assessments match', () => {
    render(<AssessmentTable {...defaultProps} assessments={[]} searchQuery="No Match" />);
    expect(screen.getAllByText(/No Match/i).length).toBeGreaterThan(0);
  });
});
