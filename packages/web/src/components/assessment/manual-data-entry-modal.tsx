'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CurrencyInput } from './currency-input';
import apiClient from '@/lib/api-client';

// ─── Field Schema ─────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'currency';

interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  unit?: string;
  mandatory?: boolean;
}

interface CategoryTab {
  id: string;
  label: string;
  fields: FieldDef[];
}

const CATEGORIES: CategoryTab[] = [
  {
    id: 'market',
    label: 'Market Risk',
    fields: [
      { id: 'market_revenue', label: 'Annual Revenue', type: 'currency', placeholder: '0', mandatory: true },
      { id: 'market_customer_count', label: 'Number of Active Customers', type: 'number', placeholder: '0', mandatory: true },
      { id: 'market_primary_market', label: 'Primary Market / Geography', type: 'text', placeholder: 'e.g. Nairobi County' },
      { id: 'market_competitor_count', label: 'Estimated Number of Competitors', type: 'number', placeholder: '0' },
      { id: 'market_export_pct', label: 'Export Revenue (%)', type: 'number', placeholder: '0', unit: '%' },
    ],
  },
  {
    id: 'production',
    label: 'Production Risk',
    fields: [
      { id: 'prod_capacity', label: 'Total Production Capacity (MT/year)', type: 'number', placeholder: '0', mandatory: true },
      { id: 'prod_utilization', label: 'Capacity Utilization (%)', type: 'number', placeholder: '0', unit: '%', mandatory: true },
      { id: 'prod_unit_cost', label: 'Average Unit Production Cost (USD)', type: 'currency', placeholder: '0' },
      { id: 'prod_waste_pct', label: 'Post-Harvest Loss / Waste (%)', type: 'number', placeholder: '0', unit: '%' },
      { id: 'prod_downtime_days', label: 'Annual Unplanned Downtime (days)', type: 'number', placeholder: '0' },
    ],
  },
  {
    id: 'supply_chain',
    label: 'Supply Chain',
    fields: [
      { id: 'sc_supplier_count', label: 'Number of Key Suppliers', type: 'number', placeholder: '0', mandatory: true },
      { id: 'sc_lead_time_days', label: 'Average Input Lead Time (days)', type: 'number', placeholder: '0', mandatory: true },
      { id: 'sc_inventory_days', label: 'Days of Inventory on Hand', type: 'number', placeholder: '0' },
      { id: 'sc_transport_cost_pct', label: 'Transport Cost as % of Revenue', type: 'number', placeholder: '0', unit: '%' },
      { id: 'sc_storage_capacity_mt', label: 'Storage Capacity (MT)', type: 'number', placeholder: '0' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial Risk',
    fields: [
      { id: 'fin_gross_margin_pct', label: 'Gross Margin (%)', type: 'number', placeholder: '0', unit: '%', mandatory: true },
      { id: 'fin_total_debt', label: 'Total Outstanding Debt (USD)', type: 'currency', placeholder: '0', mandatory: true },
      { id: 'fin_cash_reserves', label: 'Cash Reserves (USD)', type: 'currency', placeholder: '0' },
      { id: 'fin_credit_score', label: 'Credit Score (if known)', type: 'number', placeholder: '0' },
      { id: 'fin_interest_rate', label: 'Average Loan Interest Rate (%)', type: 'number', placeholder: '0', unit: '%' },
    ],
  },
  {
    id: 'environmental',
    label: 'Environment',
    fields: [
      { id: 'env_water_usage_m3', label: 'Annual Water Usage (m³)', type: 'number', placeholder: '0', mandatory: true },
      { id: 'env_rainfall_dependence_pct', label: 'Rainfall Dependence (%)', type: 'number', placeholder: '0', unit: '%', mandatory: true },
      { id: 'env_irrigated_area_ha', label: 'Irrigated Area (ha)', type: 'number', placeholder: '0' },
      { id: 'env_carbon_offsets', label: 'Carbon Offset / ESG Score (if available)', type: 'text', placeholder: 'e.g. Verified Carbon Standard' },
      { id: 'env_climate_events', label: 'Climate Events in Last 5 Years (count)', type: 'number', placeholder: '0' },
    ],
  },
  {
    id: 'regulatory',
    label: 'Regulatory',
    fields: [
      { id: 'reg_licenses_count', label: 'Number of Active Licenses/Permits', type: 'number', placeholder: '0', mandatory: true },
      { id: 'reg_fines_usd', label: 'Regulatory Fines in Last 2 Years (USD)', type: 'currency', placeholder: '0' },
      { id: 'reg_compliance_cost_pct', label: 'Compliance Cost as % of Revenue', type: 'number', placeholder: '0', unit: '%' },
      { id: 'reg_certifications', label: 'Quality / Safety Certifications', type: 'text', placeholder: 'e.g. GlobalG.A.P., ISO 22000' },
      { id: 'reg_audit_frequency', label: 'Regulatory Audits Per Year', type: 'number', placeholder: '0' },
    ],
  },
  {
    id: 'human_capital',
    label: 'Human Capital',
    fields: [
      { id: 'hc_fulltime_count', label: 'Full-Time Employees', type: 'number', placeholder: '0', mandatory: true },
      { id: 'hc_seasonal_count', label: 'Seasonal / Casual Workers', type: 'number', placeholder: '0', mandatory: true },
      { id: 'hc_turnover_rate_pct', label: 'Annual Turnover Rate (%)', type: 'number', placeholder: '0', unit: '%' },
      { id: 'hc_training_budget_usd', label: 'Annual Training Budget (USD)', type: 'currency', placeholder: '0' },
      { id: 'hc_avg_tenure_years', label: 'Average Employee Tenure (years)', type: 'number', placeholder: '0' },
    ],
  },
];

const ALL_FIELDS = CATEGORIES.flatMap((c) => c.fields);
const MANDATORY_FIELD_IDS = ALL_FIELDS.filter((f) => f.mandatory).map((f) => f.id);
const TOTAL_FIELDS = ALL_FIELDS.length;

// ─── Main Component ───────────────────────────────────────────────────────────

interface ManualDataEntryModalProps {
  assessmentId: string;
}

type FieldValues = Record<string, string>;

function getCompletionState(fields: FieldDef[], values: FieldValues) {
  const filled = fields.filter((f) => !!values[f.id]?.trim()).length;
  if (filled === 0) return 'empty';
  if (filled === fields.length) return 'complete';
  return 'partial';
}

export function ManualDataEntryModal({ assessmentId }: ManualDataEntryModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [values, setValues] = useState<FieldValues>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save on blur (debounced)
  const scheduleAutoSave = useCallback(
    (updatedValues: FieldValues) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const entries = Object.entries(updatedValues)
            .filter(([, v]) => v.trim())
            .map(([fieldId, value]) => ({ fieldId, value }));
          if (entries.length > 0) {
            await apiClient.post(`/api/assessments/${assessmentId}/data-entries`, entries);
            setHasUnsaved(false);
          }
        } catch {
          // Silent fail on auto-save
        } finally {
          setIsSaving(false);
        }
      }, 800);
    },
    [assessmentId],
  );

  function handleChange(fieldId: string, value: string) {
    const next = { ...values, [fieldId]: value };
    setValues(next);
    setHasUnsaved(true);
    scheduleAutoSave(next);
  }

  // Completion stats
  const filledCount = ALL_FIELDS.filter((f) => !!values[f.id]?.trim()).length;
  const mandatoryComplete = MANDATORY_FIELD_IDS.every((id) => !!values[id]?.trim());

  async function handleSubmit() {
    if (!mandatoryComplete) {
      setError(`Please fill all ${MANDATORY_FIELD_IDS.length} mandatory fields before submitting.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Final save
      const entries = Object.entries(values)
        .filter(([, v]) => v.trim())
        .map(([fieldId, value]) => ({ fieldId, value }));
      await apiClient.post(`/api/assessments/${assessmentId}/data-entries`, entries);

      // Trigger gap detection
      await apiClient.post(`/api/assessments/${assessmentId}/trigger-gap-detection`);

      router.push(`/assessments/${assessmentId}/gap-detector`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handleSaveAndClose() {
    setIsSaving(true);
    try {
      const entries = Object.entries(values)
        .filter(([, v]) => v.trim())
        .map(([fieldId, value]) => ({ fieldId, value }));
      if (entries.length > 0) {
        await apiClient.post(`/api/assessments/${assessmentId}/data-entries`, entries);
      }
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    }
  }

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab)!;

  return (
    <div className="flex flex-col gap-0 min-h-[500px]">
      {/* Progress bar header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-medium text-foreground">
          {filledCount} of {TOTAL_FIELDS} fields completed
        </span>
        {isSaving && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Auto-saving...
          </span>
        )}
        {!isSaving && !hasUnsaved && filledCount > 0 && (
          <span className="text-xs text-green-600">All changes saved</span>
        )}
      </div>

      <div className="flex flex-1">
        {/* Vertical side tabs */}
        <div className="w-48 shrink-0 border-r border-border bg-muted/20 py-2">
          {CATEGORIES.map((cat) => {
            const state = getCompletionState(cat.fields, values);
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold border-r-2 border-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="truncate">{cat.label}</span>
                {state === 'complete' && (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                )}
                {state === 'partial' && (
                  <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Field panel */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <h3 className="text-base font-semibold text-foreground">{activeCategory.label}</h3>

          {activeCategory.fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id} className="text-sm font-medium flex items-center gap-1">
                {field.label}
                {field.mandatory && <span className="text-destructive text-xs">*</span>}
              </Label>

              {field.type === 'currency' ? (
                <CurrencyInput
                  id={field.id}
                  value={values[field.id] ?? ''}
                  onChange={(v) => handleChange(field.id, v)}
                  unit={field.unit}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                />
              ) : (
                <div className="flex items-center gap-0">
                  <Input
                    id={field.id}
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    disabled={isSubmitting}
                    className={cn('flex-1', field.unit && 'rounded-r-none')}
                  />
                  {field.unit && (
                    <span className="h-9 px-3 flex items-center border border-l-0 border-input bg-muted text-sm text-muted-foreground rounded-r-md">
                      {field.unit}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border bg-card space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleSaveAndClose} disabled={isSubmitting}>
            Save &amp; Close
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!mandatoryComplete || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Analysis'
            )}
          </Button>
        </div>

        {!mandatoryComplete && (
          <p className="text-xs text-muted-foreground text-center">
            Fill all mandatory (*) fields to enable submission.
          </p>
        )}
      </div>
    </div>
  );
}
