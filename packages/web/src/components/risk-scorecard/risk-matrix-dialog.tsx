'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';

const SCORING_LEVELS = [
  { level: 'LOW', range: '0 - 30', label: 'Low Risk', color: 'text-green-700', bg: 'bg-green-50', description: 'Minimal risk exposure with adequate controls in place.' },
  { level: 'MODERATE', range: '31 - 60', label: 'Moderate Risk', color: 'text-yellow-700', bg: 'bg-yellow-50', description: 'Some risk exposure requiring monitoring and mitigation.' },
  { level: 'HIGH', range: '61 - 80', label: 'High Risk', color: 'text-orange-700', bg: 'bg-orange-50', description: 'Significant risk exposure requiring immediate attention.' },
  { level: 'CRITICAL', range: '81 - 100', label: 'Critical Risk', color: 'text-red-700', bg: 'bg-red-50', description: 'Severe risk exposure demanding urgent intervention.' },
] as const;

const RISK_CATEGORIES = [
  { name: 'Financial Risk', subcategories: ['Revenue Stability', 'Cost Structure', 'Debt Levels', 'Cash Flow', 'Financial Controls'] },
  { name: 'Climate & Environmental', subcategories: ['Weather Exposure', 'Climate Adaptation', 'Resource Sustainability', 'Environmental Compliance', 'Disaster Preparedness'] },
  { name: 'Behavioral Risk', subcategories: ['Management Capability', 'Decision-Making Patterns', 'Risk Awareness', 'Change Readiness', 'Stakeholder Relationships'] },
  { name: 'Operational Risk', subcategories: ['Supply Chain', 'Production Capacity', 'Process Maturity', 'Quality Controls', 'Workforce Capability'] },
  { name: 'Market Risk', subcategories: ['Market Access', 'Price Volatility', 'Competition', 'Demand Trends', 'Market Diversification'] },
  { name: 'Governance & Legal', subcategories: ['Legal Compliance', 'Governance Structure', 'Regulatory Risk', 'Contractual Obligations', 'Transparency'] },
  { name: 'Technology & Data', subcategories: ['Technology Adoption', 'Data Management', 'Cybersecurity', 'Digital Infrastructure', 'Innovation Capacity'] },
] as const;

export function RiskMatrixDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Risk Matrix
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Risk Assessment Matrix</DialogTitle>
          <DialogDescription>
            How scores are calculated across 7 categories with 35 indicators.
          </DialogDescription>
        </DialogHeader>

        {/* Scoring Scale */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Scoring Scale</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCORING_LEVELS.map((level) => (
              <div key={level.level} className={cn('rounded-lg border p-3', level.bg)}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs font-bold', level.color)}>{level.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">{level.range}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{level.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Categories & Indicators */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            7 Categories, 35 Indicators
          </h3>
          <div className="space-y-2">
            {RISK_CATEGORIES.map((cat) => (
              <details key={cat.name} className="group rounded-lg border bg-muted/20">
                <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors rounded-lg">
                  <span>{cat.name}</span>
                  <span className="text-xs text-muted-foreground">{cat.subcategories.length} indicators</span>
                </summary>
                <div className="px-3 pb-2">
                  <ul className="space-y-0.5">
                    {cat.subcategories.map((sub) => (
                      <li key={sub} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                        {sub}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Methodology */}
        <div className="rounded-lg bg-muted/30 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-1">Methodology</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each category contains 5 subcategories scored independently by AI analysis.
            Category scores represent the weighted assessment of subcategory indicators.
            The overall score is the simple average of all 7 category scores.
            Recommendations are prioritized as HIGH, MEDIUM, or LOW based on risk severity and impact.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
