import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportConfigurationDialog } from '../report-configuration-dialog';

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ReportConfigurationDialog', () => {
  it('passes updated phase 2 config values to onGenerate', async () => {
    const user = userEvent.setup();
    const onGenerate = jest.fn();

    render(
      <ReportConfigurationDialog
        open
        onOpenChange={() => {}}
        onGenerate={onGenerate}
        isGenerating={false}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /company profile/i }));
    await user.click(screen.getByRole('switch', { name: /risk heatmap/i }));
    await user.click(screen.getByRole('switch', { name: /action plan/i }));
    await user.click(screen.getByRole('switch', { name: /appendix/i }));
    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      includeCompanyProfile: false,
      includeRiskHeatmap: false,
      includeActionPlan: false,
      includeAppendix: true,
    }));
  });

  it('applies the professional preset across all configurable toggles', async () => {
    const user = userEvent.setup();
    const onGenerate = jest.fn();

    render(
      <ReportConfigurationDialog
        open
        onOpenChange={() => {}}
        onGenerate={onGenerate}
        isGenerating={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /professional/i }));
    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      includeRadarChart: true,
      includeCompanyProfile: true,
      includeRiskHeatmap: true,
      includeCategoryDetails: true,
      includeSubcategoryCharts: true,
      includeFinancialCharts: true,
      includeRecommendations: true,
      includeActionPlan: true,
      includeEvidenceTraces: true,
      includeMethodology: true,
      includeAppendix: true,
    }));
  });

  it('keeps locked toggles disabled', () => {
    render(
      <ReportConfigurationDialog
        open
        onOpenChange={() => {}}
        onGenerate={() => {}}
        isGenerating={false}
      />,
    );

    expect(screen.getByRole('switch', { name: /executive summary/i })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /disclaimer/i })).toBeDisabled();
  });

  it('wraps toggles in a scrollable body so the footer never clips (regression for Issue #1)', () => {
    render(
      <ReportConfigurationDialog
        open
        onOpenChange={() => {}}
        onGenerate={() => {}}
        isGenerating={false}
      />,
    );

    // The scrollable wrapper must exist and carry overflow-y-auto so long
    // toggle lists never push Cancel/Generate PDF below the viewport.
    const body = screen.getByTestId('report-config-dialog-body');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('flex-1');

    // Cancel and Generate PDF must still be reachable alongside the body.
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate pdf/i })).toBeInTheDocument();
  });
});
