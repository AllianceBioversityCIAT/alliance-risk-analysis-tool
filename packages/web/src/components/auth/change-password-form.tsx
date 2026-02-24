'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form } from '@/components/ui/form';
import apiClient from '@/lib/api-client';
import { tokenManager } from '@/lib/token-manager';

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface PasswordRule {
  label: string;
  test: (val: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: 'Minimum 8 characters', test: (v) => v.length >= 8 },
  { label: 'Capital letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A digit (0–9)', test: (v) => /[0-9]/.test(v) },
];

interface ChangePasswordFormProps {
  username: string;
  session: string;
  onSuccess?: () => void;
}

export function ChangePasswordForm({ username, session, onSuccess }: ChangePasswordFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
    mode: 'onChange',
  });

  const { isSubmitting, errors } = form.formState;
  const newPasswordValue = form.watch('newPassword');
  const confirmPasswordValue = form.watch('confirmPassword');

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setServerError(null);
    try {
      const response = await apiClient.post<{
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      }>('/api/auth/complete-password-change', {
        username,
        session,
        newPassword: values.newPassword,
      });

      const data = response.data;
      if (data.accessToken) {
        tokenManager.setTokens(
          {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? '',
          },
          false, // Default to session storage on first login
        );
      }

      onSuccess?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to change password. Please try again.';
      setServerError(typeof message === 'string' ? message : 'Failed to change password.');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            You must set a new password before continuing. Choose a strong password you&apos;ll remember.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="newPassword" className="text-sm font-medium">New password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            disabled={isSubmitting}
            className="h-10"
            {...form.register('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-destructive text-sm" data-slot="form-message">{errors.newPassword.message}</p>
          )}
        </div>

        {/* Password requirements checklist */}
        {newPasswordValue && (
          <ul className="space-y-1 text-xs" aria-label="Password requirements">
            {passwordRules.map((rule) => {
              const passes = rule.test(newPasswordValue);
              return (
                <li key={rule.label} className={`flex items-center gap-1.5 ${passes ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {passes ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-1">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isSubmitting}
            className={`h-10 ${
              confirmPasswordValue && newPasswordValue !== confirmPasswordValue
                ? 'border-destructive focus-visible:ring-destructive'
                : ''
            }`}
            {...form.register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-sm" data-slot="form-message">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full h-10" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password…</>
          ) : (
            'Set New Password'
          )}
        </Button>
      </form>
    </Form>
  );
}
