'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStep {
  label: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number; // 0-indexed
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={cn('flex items-center', !isLast && 'flex-1')}
            >
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0 transition-colors',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                        ? 'bg-card border-primary text-primary'
                        : 'bg-card border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium whitespace-nowrap hidden sm:block',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
