import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartAssessmentModal } from '../start-assessment-modal';

const mockCreateAssessment = jest.fn();
const mockUpdateAssessment = jest.fn();
const mockPush = jest.fn();
const mockUseCountryFilter = jest.fn(() => ({ activeCountry: 'Kenya', setActiveCountry: jest.fn() }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/providers/country-filter-provider', () => ({
  ALL_COUNTRIES_FILTER: 'ALL_COUNTRIES',
  useCountryFilter: () => mockUseCountryFilter(),
  CountryFilterProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks/use-assessments', () => ({
  useCreateAssessment: () => ({
    mutateAsync: mockCreateAssessment,
    isPending: false,
  }),
  useUpdateAssessment: () => ({
    mutateAsync: mockUpdateAssessment,
    isPending: false,
  }),
}));

describe('StartAssessmentModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAssessment.mockResolvedValue({ id: 'new-assessment-id' });
    mockUseCountryFilter.mockReturnValue({ activeCountry: 'Kenya', setActiveCountry: jest.fn() });
  });

  it('renders four country options', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<StartAssessmentModal open onOpenChange={jest.fn()} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]);

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Kenya'),
        expect.stringContaining('Ethiopia'),
        expect.stringContaining('Nigeria'),
        expect.stringContaining('Zambia'),
      ]),
    );
  });

  it('includes country in create payload', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<StartAssessmentModal open onOpenChange={jest.fn()} />);

    await user.type(screen.getByPlaceholderText(/kenya dairy farm/i), 'Test Assessment');
    await user.type(screen.getByPlaceholderText(/sunrise agro/i), 'Test Co');

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]);
    await user.click(await screen.findByRole('option', { name: /SME/i }));

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getAllByRole('button', { name: /select upload/i })[0]);

    await waitFor(() => {
      expect(mockCreateAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'Kenya' }),
      );
    });
  });

  it('defaults the country field to Kenya when activeCountry is the "All countries" sentinel', () => {
    mockUseCountryFilter.mockReturnValue({ activeCountry: 'ALL_COUNTRIES', setActiveCountry: jest.fn() });
    render(<StartAssessmentModal open onOpenChange={jest.fn()} />);

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[1]).toHaveTextContent('Kenya');
    expect(comboboxes[1]).not.toHaveTextContent('ALL_COUNTRIES');
  });

  it('still lists exactly the 4 real countries when activeCountry is the sentinel', async () => {
    mockUseCountryFilter.mockReturnValue({ activeCountry: 'ALL_COUNTRIES', setActiveCountry: jest.fn() });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<StartAssessmentModal open onOpenChange={jest.fn()} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]);

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Kenya'),
        expect.stringContaining('Ethiopia'),
        expect.stringContaining('Nigeria'),
        expect.stringContaining('Zambia'),
      ]),
    );
    expect(options.every((o) => !o.textContent?.includes('All countries'))).toBe(true);
  });

  it('auto-draft-saves with country: "Kenya" when closing before finishing while "All countries" is active', async () => {
    mockUseCountryFilter.mockReturnValue({ activeCountry: 'ALL_COUNTRIES', setActiveCountry: jest.fn() });
    const onOpenChange = jest.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<StartAssessmentModal open onOpenChange={onOpenChange} />);

    // Start filling the form but do not submit step 1 — close via Cancel,
    // which triggers handleClose's existing auto-draft-save path.
    await user.type(screen.getByPlaceholderText(/kenya dairy farm/i), 'Draft Assessment');
    await user.type(screen.getByPlaceholderText(/sunrise agro/i), 'Draft Co');

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(mockCreateAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'Kenya' }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
