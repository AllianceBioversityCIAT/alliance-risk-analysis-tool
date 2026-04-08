'use client';

import { useState } from 'react';
import { Info, ChevronRight, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getCategoryConfig } from './category-config';

const SCORING_LEVELS = [
  {
    level: 'LOW',
    range: '0 — 30',
    label: 'Low',
    accent: 'border-l-green-500',
    color: 'text-green-700',
    bg: 'bg-green-50/60',
    dot: 'bg-green-500',
    description: 'Minimal risk exposure with adequate controls in place.',
  },
  {
    level: 'MODERATE',
    range: '31 — 60',
    label: 'Moderate',
    accent: 'border-l-yellow-500',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50/60',
    dot: 'bg-yellow-500',
    description: 'Some risk exposure requiring monitoring and mitigation.',
  },
  {
    level: 'HIGH',
    range: '61 — 80',
    label: 'High',
    accent: 'border-l-orange-500',
    color: 'text-orange-700',
    bg: 'bg-orange-50/60',
    dot: 'bg-orange-500',
    description: 'Significant risk exposure requiring immediate attention.',
  },
  {
    level: 'CRITICAL',
    range: '81 — 100',
    label: 'Critical',
    accent: 'border-l-red-500',
    color: 'text-red-700',
    bg: 'bg-red-50/60',
    dot: 'bg-red-500',
    description: 'Severe risk exposure demanding urgent intervention.',
  },
] as const;

const RISK_CATEGORIES = [
  { key: 'FINANCIAL', name: 'Financial Risk', subcategories: ['Revenue Stability', 'Cost Structure', 'Debt Levels', 'Cash Flow', 'Financial Controls'] },
  { key: 'CLIMATE_ENVIRONMENTAL', name: 'Climate & Environmental', subcategories: ['Weather Exposure', 'Climate Adaptation', 'Resource Sustainability', 'Environmental Compliance', 'Disaster Preparedness'] },
  { key: 'BEHAVIORAL', name: 'Behavioral Risk', subcategories: ['Management Capability', 'Decision-Making Patterns', 'Risk Awareness', 'Change Readiness', 'Stakeholder Relationships'] },
  { key: 'OPERATIONAL', name: 'Operational Risk', subcategories: ['Supply Chain', 'Production Capacity', 'Process Maturity', 'Quality Controls', 'Workforce Capability'] },
  { key: 'MARKET', name: 'Market Risk', subcategories: ['Market Access', 'Price Volatility', 'Competition', 'Demand Trends', 'Market Diversification'] },
  { key: 'GOVERNANCE_LEGAL', name: 'Governance & Legal', subcategories: ['Legal Compliance', 'Governance Structure', 'Regulatory Risk', 'Contractual Obligations', 'Transparency'] },
  { key: 'TECHNOLOGY_DATA', name: 'Technology & Data', subcategories: ['Technology Adoption', 'Data Management', 'Cybersecurity', 'Digital Infrastructure', 'Innovation Capacity'] },
] as const;

export function RiskMatrixDialog() {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Risk Matrix
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header — pinned top */}
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Risk Assessment Matrix</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  7 categories &middot; 35 indicators &middot; 0-100 scoring scale
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {/* Scoring Scale — horizontal gradient bar + cards */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scoring Scale</h3>
            </div>

            {/* Continuous gradient bar */}
            <div className="h-2 rounded-full overflow-hidden mb-3 flex">
              <div className="flex-1 bg-gradient-to-r from-green-400 to-green-500" />
              <div className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500" />
              <div className="flex-1 bg-gradient-to-r from-orange-400 to-orange-500" />
              <div className="flex-1 bg-gradient-to-r from-red-400 to-red-500" />
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-[10px] text-muted-foreground font-mono">0</span>
              <span className="text-[10px] text-muted-foreground font-mono">30</span>
              <span className="text-[10px] text-muted-foreground font-mono">60</span>
              <span className="text-[10px] text-muted-foreground font-mono">80</span>
              <span className="text-[10px] text-muted-foreground font-mono">100</span>
            </div>

            {/* Level cards with left accent border */}
            <div className="grid grid-cols-2 gap-2">
              {SCORING_LEVELS.map((level) => (
                <div
                  key={level.level}
                  className={cn(
                    'rounded-lg border-l-[3px] border border-border/60 p-2.5',
                    level.accent,
                    level.bg,
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', level.dot)} />
                      <span className={cn('text-xs font-semibold', level.color)}>{level.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">{level.range}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug pl-3.5">{level.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-border via-border/60 to-transparent" />

          {/* Categories & Indicators */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categories & Indicators
              </h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                7 &times; 5 = 35 total
              </span>
            </div>

            <div className="space-y-1">
              {RISK_CATEGORIES.map((cat) => {
                const isOpen = expandedCat === cat.key;
                const catConfig = getCategoryConfig(cat.key);
                const CatIcon = catConfig.icon;

                return (
                  <div key={cat.key} className="rounded-lg border border-border/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedCat(isOpen ? null : cat.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                    >
                      <CatIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                      <span className="text-[10px] text-muted-foreground mr-1">{cat.subcategories.length}</span>
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 text-muted-foreground/60 shrink-0 transition-transform duration-200',
                          isOpen && 'rotate-90',
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-2.5 pt-0">
                        <div className="ml-6 pl-2.5 border-l-2 border-primary/15 space-y-1">
                          {cat.subcategories.map((sub) => (
                            <p key={sub} className="text-xs text-muted-foreground py-0.5">
                              {sub}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Methodology */}
          <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3.5">
            <h3 className="text-xs font-semibold text-primary mb-1.5">Methodology</h3>
            <div className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
              <p>Each category contains 5 subcategories scored independently by AI analysis of uploaded documents, gap detection data, and interview responses.</p>
              <p>The overall score is the simple average of all 7 category scores. Recommendations are prioritized as HIGH, MEDIUM, or LOW based on risk severity and potential impact on business resilience.</p>
            </div>
          </div>
        </div>

        {/* Footer — pinned bottom */}
        <DialogFooter className="shrink-0 border-t border-border px-6 py-3" showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
