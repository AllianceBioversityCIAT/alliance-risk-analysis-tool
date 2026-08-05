import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from '../app-header';
import { ALL_COUNTRIES_FILTER } from '@/providers/country-filter-provider';

// AppHeader only needs a trigger button here — the real SidebarTrigger pulls in
// TooltipProvider/Sheet/mobile-detection machinery unrelated to the country
// dropdown under test.
jest.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button aria-label="Toggle sidebar" />,
}));

function renderAppHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  return render(
    <AppHeader
      title="Dashboard"
      activeCountry={ALL_COUNTRIES_FILTER}
      onCountryChange={jest.fn()}
      {...props}
    />,
  );
}

describe('AppHeader', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders exactly 5 options with "All countries" first when the dropdown is opened', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderAppHeader();

    await user.click(screen.getByRole('button', { name: /select country context/i }));

    const options = await screen.findAllByRole('menuitem');
    expect(options).toHaveLength(5);
    expect(options[0]).toHaveTextContent('All countries');
    expect(options[1]).toHaveTextContent('Kenya');
    expect(options[2]).toHaveTextContent('Ethiopia');
    expect(options[3]).toHaveTextContent('Nigeria');
    expect(options[4]).toHaveTextContent('Zambia');
  });

  it('calls onCountryChange(ALL_COUNTRIES_FILTER) when "All countries" is clicked', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onCountryChange = jest.fn();
    renderAppHeader({ activeCountry: 'Kenya', onCountryChange });

    await user.click(screen.getByRole('button', { name: /select country context/i }));
    await user.click(await screen.findByRole('menuitem', { name: /all countries/i }));

    expect(onCountryChange).toHaveBeenCalledWith(ALL_COUNTRIES_FILTER);
  });

  it('renders with activeCountry={ALL_COUNTRIES_FILTER} without throwing, showing "All countries" and 🌍 rather than the raw sentinel value', () => {
    expect(() => renderAppHeader()).not.toThrow();

    const trigger = screen.getByRole('button', { name: /select country context/i });
    expect(trigger).toHaveTextContent('All countries');
    expect(trigger).toHaveTextContent('🌍');
    expect(trigger).not.toHaveTextContent(ALL_COUNTRIES_FILTER);
  });
});
