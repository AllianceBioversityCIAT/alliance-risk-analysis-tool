'use client';

import { useState } from 'react';
import { Settings2, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReportConfig, SubcategoryChartType } from '@alliance-risk/shared';

interface ReportConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: ReportConfig) => void;
  isGenerating: boolean;
}

const DEFAULT_CONFIG: ReportConfig = {
  includeRadarChart: true,
  includeCompanyProfile: true,
  includeRiskHeatmap: true,
  includeCategoryDetails: true,
  includeSubcategoryCharts: false,
  subcategoryChartType: 'bar',
  includeFinancialCharts: false,
  includeRecommendations: true,
  includeActionPlan: true,
  includeEvidenceTraces: false,
  includeMethodology: true,
  includeAppendix: false,
};

const PROFESSIONAL_CONFIG: ReportConfig = {
  includeRadarChart: true,
  includeCompanyProfile: true,
  includeRiskHeatmap: true,
  includeCategoryDetails: true,
  includeSubcategoryCharts: true,
  subcategoryChartType: 'bar',
  includeFinancialCharts: true,
  includeRecommendations: true,
  includeActionPlan: true,
  includeEvidenceTraces: true,
  includeMethodology: true,
  includeAppendix: true,
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  const switchId = `report-config-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={switchId} className="flex items-center gap-2 text-sm font-medium">
          {label}
          {disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={switchId} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function ReportConfigurationDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: ReportConfigurationDialogProps) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);

  const update = (key: keyof ReportConfig, value: boolean | SubcategoryChartType) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const applyProfessionalPreset = () => {
    setConfig(PROFESSIONAL_CONFIG);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl"
        data-testid="report-config-dialog"
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Report Configuration
          </DialogTitle>
          <DialogDescription>
            Choose which sections to include in your generated report.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto px-6 py-4"
          data-testid="report-config-dialog-body"
        >
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Report sections</p>
              <p className="text-xs text-muted-foreground">Arrange the exported PDF to match the report flow and depth you need.</p>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={applyProfessionalPreset}>
              <Sparkles className="h-4 w-4 text-primary" />
              Professional
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border/70 bg-background">
            <div className="border-b border-border/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Core sections</p>
            </div>
            <div className="divide-y divide-border px-4">
              <ToggleRow
                label="Executive Summary"
                description="Overview with overall score and key findings"
                checked={true}
                onCheckedChange={() => {}}
                disabled
              />
              <ToggleRow
                label="Company Profile"
                description="Assessment metadata and organization background"
                checked={config.includeCompanyProfile}
                onCheckedChange={(v) => update('includeCompanyProfile', v)}
              />
              <ToggleRow
                label="Risk Radar Chart"
                description="Spider chart showing risk exposure across all categories"
                checked={config.includeRadarChart}
                onCheckedChange={(v) => update('includeRadarChart', v)}
              />
              <ToggleRow
                label="Risk Heatmap"
                description="Zone-based placement of category scores across risk tiers"
                checked={config.includeRiskHeatmap}
                onCheckedChange={(v) => update('includeRiskHeatmap', v)}
              />
              <ToggleRow
                label="Category Detail Pages"
                description="In-depth analysis for each of the 7 risk categories"
                checked={config.includeCategoryDetails}
                onCheckedChange={(v) => update('includeCategoryDetails', v)}
              />
              <div>
                <ToggleRow
                  label="Subcategory Charts"
                  description="Visual charts for subcategory score breakdowns"
                  checked={config.includeSubcategoryCharts}
                  onCheckedChange={(v) => update('includeSubcategoryCharts', v)}
                />
                {config.includeSubcategoryCharts ? (
                  <div className="pb-3 pl-1">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Chart Type</Label>
                    <Select
                      value={config.subcategoryChartType}
                      onValueChange={(v) => update('subcategoryChartType', v as SubcategoryChartType)}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="radar">Radar Chart</SelectItem>
                        <SelectItem value="donut">Donut Chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              <ToggleRow
                label="Financial Charts"
                description="Revenue trends and cost breakdowns extracted from documents"
                checked={config.includeFinancialCharts}
                onCheckedChange={(v) => update('includeFinancialCharts', v)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background">
            <div className="border-b border-border/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recommendations and closing</p>
            </div>
            <div className="divide-y divide-border px-4">
              <ToggleRow
                label="Recommendations"
                description="Prioritized action items for risk mitigation"
                checked={config.includeRecommendations}
                onCheckedChange={(v) => update('includeRecommendations', v)}
              />
              <ToggleRow
                label="Action Plan"
                description="Time-bucketed execution plan derived from recommendations"
                checked={config.includeActionPlan}
                onCheckedChange={(v) => update('includeActionPlan', v)}
              />
              <ToggleRow
                label="Evidence Traces"
                description="Source document references for each finding and appendix evidence"
                checked={config.includeEvidenceTraces}
                onCheckedChange={(v) => update('includeEvidenceTraces', v)}
              />
              <ToggleRow
                label="Methodology"
                description="Explanation of scoring methodology and risk levels"
                checked={config.includeMethodology}
                onCheckedChange={(v) => update('includeMethodology', v)}
              />
              <ToggleRow
                label="Appendix"
                description="Document inventory, gap summary, and optional supporting evidence"
                checked={config.includeAppendix}
                onCheckedChange={(v) => update('includeAppendix', v)}
              />
              <ToggleRow
                label="Disclaimer"
                description="Required legal notice included as the final page of the PDF"
                checked={true}
                onCheckedChange={() => {}}
                disabled
              />
            </div>
          </section>
        </div>

        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={() => onGenerate(config)} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
