'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
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
  includeCategoryDetails: true,
  includeSubcategoryCharts: false,
  subcategoryChartType: 'bar',
  includeFinancialCharts: false,
  includeRecommendations: true,
  includeEvidenceTraces: false,
  includeMethodology: true,
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Report Configuration
          </DialogTitle>
          <DialogDescription>
            Choose which sections to include in your generated report.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border">
          <ToggleRow
            label="Executive Summary"
            description="Overview with overall score and key findings"
            checked={true}
            onCheckedChange={() => {}}
            disabled
          />
          <ToggleRow
            label="Risk Radar Chart"
            description="Spider chart showing risk exposure across all categories"
            checked={config.includeRadarChart}
            onCheckedChange={(v) => update('includeRadarChart', v)}
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
            {config.includeSubcategoryCharts && (
              <div className="pb-3 pl-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Chart Type</Label>
                <Select
                  value={config.subcategoryChartType}
                  onValueChange={(v) => update('subcategoryChartType', v as SubcategoryChartType)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="radar">Radar Chart</SelectItem>
                    <SelectItem value="donut">Donut Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <ToggleRow
            label="Financial Data Charts"
            description="Revenue trends and cost breakdowns extracted from documents"
            checked={config.includeFinancialCharts}
            onCheckedChange={(v) => update('includeFinancialCharts', v)}
          />
          <ToggleRow
            label="Recommendations"
            description="Prioritized action items for risk mitigation"
            checked={config.includeRecommendations}
            onCheckedChange={(v) => update('includeRecommendations', v)}
          />
          <ToggleRow
            label="Evidence Traces"
            description="Source document references for each finding"
            checked={config.includeEvidenceTraces}
            onCheckedChange={(v) => update('includeEvidenceTraces', v)}
          />
          <ToggleRow
            label="Methodology"
            description="Explanation of scoring methodology and risk levels"
            checked={config.includeMethodology}
            onCheckedChange={(v) => update('includeMethodology', v)}
          />
        </div>

        <DialogFooter>
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
