'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardStepper } from './wizard-stepper';
import { ChoiceCards } from './choice-cards';
import apiClient from '@/lib/api-client';

// ─── Question Schema ──────────────────────────────────────────────────────────

type QuestionType = 'text' | 'number' | 'choice';

interface Question {
  id: string;
  label: string;
  type: QuestionType;
  placeholder?: string;
  required?: boolean;
  choiceOptions?: { value: string; label: string }[];
}

interface Step {
  category: string;
  questions: Question[];
}

const INTERVIEW_STEPS: Step[] = [
  {
    category: 'Market Risk',
    questions: [
      { id: 'market_geography', label: 'What markets do you currently operate in?', type: 'text', placeholder: 'e.g. Nairobi, Mombasa, rural Western Kenya', required: true },
      { id: 'market_competition', label: 'How intense is competition in your primary market?', type: 'choice', choiceOptions: [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }] },
      { id: 'market_customers', label: 'How many active customers do you serve?', type: 'number', placeholder: 'e.g. 250' },
      { id: 'market_revenue_growth', label: 'Did your revenue grow in the last 12 months?', type: 'choice' },
    ],
  },
  {
    category: 'Production Risk',
    questions: [
      { id: 'prod_capacity_util', label: 'What percentage of your production capacity do you currently use?', type: 'number', placeholder: 'e.g. 75' },
      { id: 'prod_disruptions', label: 'Have you experienced production disruptions in the last year?', type: 'choice' },
      { id: 'prod_quality_control', label: 'Do you have a formal quality control process?', type: 'choice' },
      { id: 'prod_technology', label: 'Describe your primary production technology or methods', type: 'text', placeholder: 'e.g. drip irrigation, greenhouse cultivation' },
    ],
  },
  {
    category: 'Supply Chain Risk',
    questions: [
      { id: 'sc_suppliers', label: 'How many primary suppliers do you rely on?', type: 'number', placeholder: 'e.g. 5' },
      { id: 'sc_single_source', label: 'Are any critical inputs sourced from a single supplier?', type: 'choice' },
      { id: 'sc_storage', label: 'Do you have on-site storage or cold chain facilities?', type: 'choice' },
      { id: 'sc_lead_time', label: 'What is your typical input lead time in days?', type: 'number', placeholder: 'e.g. 14' },
    ],
  },
  {
    category: 'Financial Risk',
    questions: [
      { id: 'fin_annual_revenue', label: 'What is your approximate annual revenue (USD)?', type: 'number', placeholder: 'e.g. 120000' },
      { id: 'fin_debt', label: 'Do you currently have outstanding loans or debt?', type: 'choice' },
      { id: 'fin_insurance', label: 'Do you have crop or business insurance?', type: 'choice' },
      { id: 'fin_cash_reserves', label: 'How many months of operating expenses can you cover with cash reserves?', type: 'number', placeholder: 'e.g. 3' },
    ],
  },
  {
    category: 'Environmental / Climate Risk',
    questions: [
      { id: 'env_climate_impact', label: 'Has your operation been significantly affected by weather events in the last 3 years?', type: 'choice' },
      { id: 'env_water_access', label: 'Is your water supply reliable year-round?', type: 'choice' },
      { id: 'env_mitigation', label: 'Do you use any climate adaptation measures?', type: 'text', placeholder: 'e.g. drought-resistant seeds, rainwater harvesting' },
    ],
  },
  {
    category: 'Regulatory & Compliance Risk',
    questions: [
      { id: 'reg_licenses', label: 'Do you have all required operating licenses and permits?', type: 'choice' },
      { id: 'reg_compliance_issues', label: 'Have you faced regulatory fines or issues in the last 2 years?', type: 'choice' },
      { id: 'reg_certifications', label: 'Do you hold any agricultural or food safety certifications?', type: 'text', placeholder: 'e.g. GlobalG.A.P., Organic, HACCP' },
    ],
  },
  {
    category: 'Human Capital Risk',
    questions: [
      { id: 'hc_employees', label: 'How many full-time employees do you have?', type: 'number', placeholder: 'e.g. 12' },
      { id: 'hc_turnover', label: 'Is employee turnover a challenge for your business?', type: 'choice' },
      { id: 'hc_training', label: 'Do you provide regular training for your employees?', type: 'choice' },
      { id: 'hc_key_person', label: 'Is the business heavily dependent on one key person?', type: 'choice' },
    ],
  },
];

const WIZARD_STEPS = INTERVIEW_STEPS.map((s) => ({ label: s.category }));

interface GuidedInterviewModalProps {
  assessmentId: string;
}

type Answers = Record<string, string>;

export function GuidedInterviewModal({ assessmentId }: GuidedInterviewModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = INTERVIEW_STEPS[currentStep];
  const totalSteps = INTERVIEW_STEPS.length;
  const progressPct = Math.round(((currentStep) / totalSteps) * 100);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const currentStepAnswers = step.questions.reduce<Answers>((acc, q) => {
    if (answers[q.id] !== undefined) acc[q.id] = answers[q.id];
    return acc;
  }, {});

  const requiredComplete = step.questions
    .filter((q) => q.required)
    .every((q) => !!answers[q.id]?.trim());

  async function saveStep(stepAnswers: Answers) {
    setIsSaving(true);
    setError(null);
    try {
      const payload = Object.entries(stepAnswers).map(([questionId, value]) => ({
        questionId,
        value,
        category: step.category,
      }));
      await apiClient.post(`/api/assessments/${assessmentId}/interview-answers`, payload);
    } catch {
      setError('Failed to save answers. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNext() {
    await saveStep(currentStepAnswers);
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await saveStep(currentStepAnswers);
      // Trigger gap detection job
      await apiClient.post(`/api/assessments/${assessmentId}/trigger-gap-detection`);
      router.push(`/assessments/gap-detector?id=${assessmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setIsSubmitting(false);
    }
  }

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <WizardStepper steps={WIZARD_STEPS} currentStep={currentStep} />

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {currentStep + 1} of {totalSteps} — {step.category}
        </span>
        <span>{progressPct}% complete</span>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {step.questions.map((q) => (
          <div key={q.id} className="space-y-2">
            <Label htmlFor={q.id} className="text-sm font-medium">
              {q.label}
              {q.required && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {q.type === 'text' && (
              <Input
                id={q.id}
                placeholder={q.placeholder}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                disabled={isSaving || isSubmitting}
              />
            )}

            {q.type === 'number' && (
              <Input
                id={q.id}
                type="number"
                placeholder={q.placeholder}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                disabled={isSaving || isSubmitting}
              />
            )}

            {q.type === 'choice' && (
              <ChoiceCards
                value={answers[q.id] ?? null}
                onChange={(v) => setAnswer(q.id, v)}
                options={q.choiceOptions}
                disabled={isSaving || isSubmitting}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={() => currentStep > 0 ? setCurrentStep((s) => s - 1) : router.push('/dashboard')}
          disabled={isSaving || isSubmitting}
        >
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        <Button
          onClick={isLastStep ? handleSubmit : handleNext}
          disabled={!requiredComplete || isSaving || isSubmitting}
        >
          {isSaving || isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isSubmitting ? 'Submitting...' : 'Saving...'}
            </>
          ) : isLastStep ? (
            'Submit Interview'
          ) : (
            'Next'
          )}
        </Button>
      </div>
    </div>
  );
}
