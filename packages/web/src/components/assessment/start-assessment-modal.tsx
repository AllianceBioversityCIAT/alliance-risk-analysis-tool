'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, MessageSquare, PenLine, Loader2, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IntakeModeCard, FormatBadges, FeatureList } from './intake-mode-card';
import { useCreateAssessment, useUpdateAssessment } from '@/hooks/use-assessments';
import { IntakeMode } from '@alliance-risk/shared';
import { cn } from '@/lib/utils';
import type { AssessmentRowData } from '@/components/dashboard/assessment-table-row';

const COMPANY_TYPES = [
  'Startup',
  'SME',
  'Large Enterprise',
  'NGO / Non-Profit',
  'Cooperative',
  'Government Agency',
  'Other',
];

const businessInfoSchema = z.object({
  name: z.string().min(2, 'Assessment name must be at least 2 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companyType: z.string().min(1, 'Please select a company type'),
});

type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

interface StartAssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftAssessment?: AssessmentRowData | null;
}

type Step = 'business-info' | 'intake-mode';

export function StartAssessmentModal({ open, onOpenChange, draftAssessment }: StartAssessmentModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('business-info');
  const [selectedMode, setSelectedMode] = useState<IntakeMode | null>(null);
  const [formValues, setFormValues] = useState<BusinessInfoFormValues | null>(null);

  const { mutateAsync: createAssessment, isPending: isCreating } = useCreateAssessment();
  const { mutateAsync: updateAssessment, isPending: isUpdating } = useUpdateAssessment();
  const isPending = isCreating || isUpdating;

  const isResumingDraft = !!draftAssessment;

  const form = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: draftAssessment
      ? {
          name: draftAssessment.name,
          companyName: draftAssessment.companyName,
          companyType: draftAssessment.companyType ?? '',
        }
      : { name: '', companyName: '', companyType: '' },
  });

  // Reset form values when draftAssessment changes
  useEffect(() => {
    if (draftAssessment) {
      form.reset({
        name: draftAssessment.name,
        companyName: draftAssessment.companyName,
        companyType: draftAssessment.companyType ?? '',
      });
    }
  }, [draftAssessment, form]);

  async function handleClose() {
    // If form has valid data and not resuming an existing draft, save as new draft
    const currentValues = form.getValues();
    const hasData = currentValues.name.length >= 2 && currentValues.companyName.length >= 2;

    if (hasData && !isResumingDraft) {
      try {
        await createAssessment({
          name: currentValues.name,
          companyName: currentValues.companyName,
          companyType: currentValues.companyType || undefined,
          country: 'Kenya',
          intakeMode: IntakeMode.UPLOAD, // Default mode for drafts
        });
      } catch {
        // Silent fail — don't block close
      }
    }

    onOpenChange(false);
    setTimeout(() => {
      setStep('business-info');
      setSelectedMode(null);
      setFormValues(null);
      form.reset({ name: '', companyName: '', companyType: '' });
    }, 300);
  }

  function handleStep1Submit(values: BusinessInfoFormValues) {
    setFormValues(values);
    setStep('intake-mode');
  }

  async function handleModeSelect(mode: IntakeMode) {
    setSelectedMode(mode);
    if (!formValues) return;

    try {
      let assessmentId: string;

      if (isResumingDraft && draftAssessment) {
        // Update existing draft
        await updateAssessment({
          id: draftAssessment.id,
          data: {
            name: formValues.name,
            companyName: formValues.companyName,
            companyType: formValues.companyType,
          },
        });
        assessmentId = draftAssessment.id;
      } else {
        // Create new assessment
        const assessment = await createAssessment({
          name: formValues.name,
          companyName: formValues.companyName,
          companyType: formValues.companyType,
          country: 'Kenya',
          intakeMode: mode,
        });
        assessmentId = assessment.id;
      }

      // Close without saving draft again
      onOpenChange(false);
      setTimeout(() => {
        setStep('business-info');
        setSelectedMode(null);
        setFormValues(null);
        form.reset({ name: '', companyName: '', companyType: '' });
      }, 300);

      switch (mode) {
        case IntakeMode.UPLOAD:
          router.push(`/assessments/upload?id=${assessmentId}`);
          break;
        case IntakeMode.GUIDED_INTERVIEW:
          router.push(`/assessments/interview?id=${assessmentId}`);
          break;
        case IntakeMode.MANUAL_ENTRY:
          router.push(`/assessments/manual-entry?id=${assessmentId}`);
          break;
      }
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'transition-all duration-200',
          step === 'intake-mode' ? 'sm:max-w-[896px]' : 'sm:max-w-[520px]',
        )}
      >
        {/* Step 1: Business Info */}
        {step === 'business-info' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                {isResumingDraft ? 'Resume Draft Assessment' : 'Start New Assessment'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleStep1Submit)} className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kenya Dairy Farm 2026 Q1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company / Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sunrise Agro Ltd." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country — locked to Kenya for MVP */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <div className="flex h-9 items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    <span className="mr-2 text-base">🇰🇪</span>
                    Kenya
                    <span className="ml-auto text-xs">(MVP)</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit">Next</Button>
                </div>
              </form>
            </Form>
          </>
        )}

        {/* Step 2: Intake mode selection — matches Figma */}
        {step === 'intake-mode' && (
          <>
            <DialogHeader className="pb-0">
              <DialogTitle className="text-2xl font-bold text-[#111827]">
                Select Intake Mode
              </DialogTitle>
              <p className="text-sm text-[#64748B]">
                Choose how you want to input data for the new risk assessment.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-6 py-8 px-1">
              {/* Upload Business Plan */}
              <IntakeModeCard
                icon={Upload}
                title="Upload Business Plan"
                description="Automatically extract financial data and risk factors from existing documents."
                features={<FormatBadges />}
                buttonLabel="Select Upload"
                isSelected={selectedMode === IntakeMode.UPLOAD}
                isPending={isPending}
                onSelect={() => !isPending && handleModeSelect(IntakeMode.UPLOAD)}
              />

              {/* Guided Interview — coming soon */}
              <IntakeModeCard
                icon={MessageSquare}
                title="Guided Interview"
                description="Interactive AI chatbot assistant that guides you through collecting necessary data points."
                features={
                  <FeatureList
                    muted
                    items={[
                      'Structured Q&A flow',
                      'Real-time validation',
                      'Auto-save progress',
                    ]}
                  />
                }
                buttonLabel="Start Interview"
                isSelected={false}
                isPending={false}
                isComingSoon
                onSelect={() => {}}
              />

              {/* Manual Entry — coming soon */}
              <IntakeModeCard
                icon={PenLine}
                title="Manual Entry"
                description="Directly input data into the standard comprehensive risk assessment form."
                features={
                  <FeatureList
                    muted
                    items={[
                      'Full control over fields',
                      'Bulk data entry',
                      'Offline capable',
                    ]}
                  />
                }
                buttonLabel="Open Form"
                isSelected={false}
                isPending={false}
                isComingSoon
                onSelect={() => {}}
              />
            </div>

            {isPending && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating assessment...
              </div>
            )}

            {/* Footer — matches Figma */}
            <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-5 pb-1 px-1">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                onClick={() => setStep('business-info')}
                disabled={isPending}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Need help deciding?
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
