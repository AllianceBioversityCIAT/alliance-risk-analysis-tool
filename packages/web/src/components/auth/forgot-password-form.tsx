'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import apiClient from '@/lib/api-client';

// ─── Step 1: Email ────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .transform((val) => val.toLowerCase().trim()),
});

type EmailFormValues = z.infer<typeof emailSchema>;

// ─── Step 2: Code + New Password ─────────────────────────────────────────────

const resetSchema = z
  .object({
    code: z.string().min(1, 'Verification code is required'),
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

type ResetFormValues = z.infer<typeof resetSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [sentEmail, setSentEmail] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  // Step 1 form
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  // Step 2 form
  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  const handleSendCode = async (values: EmailFormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/api/auth/forgot-password', { email: values.email });
      setSentEmail(values.email);
      setStep('reset');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to send reset code. Please try again.';
      setServerError(typeof message === 'string' ? message : 'Failed to send reset code.');
    }
  };

  const handleReset = async (values: ResetFormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/api/auth/reset-password', {
        username: sentEmail,
        code: values.code,
        newPassword: values.newPassword,
      });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to reset password. Please try again.';
      setServerError(typeof message === 'string' ? message : 'Failed to reset password.');
    }
  };

  // Step 1: Email form
  if (step === 'email') {
    return (
      <Form {...emailForm}>
        <form onSubmit={emailForm.handleSubmit(handleSendCode)} className="space-y-5" noValidate>
          {serverError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Enter your email address and we&apos;ll send you a verification code to reset your password.
            </p>
          </div>

          <FormField
            control={emailForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <FormControl>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    disabled={emailForm.formState.isSubmitting}
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full h-10" disabled={emailForm.formState.isSubmitting}>
            {emailForm.formState.isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
            ) : (
              'Send Reset Code'
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </Form>
    );
  }

  // Step 2: Code + new password form
  return (
    <Form {...resetForm}>
      <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-5" noValidate>
        {serverError && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            We sent a verification code to <strong className="text-foreground">{sentEmail}</strong>.
            Enter the code and your new password below.
          </p>
        </div>

        {/* Code field — uses register (not Controller) to avoid React 19 controlled input race condition */}
        <div className="grid gap-2">
          <Label htmlFor="code" className="text-sm font-medium">Verification code</Label>
          <Input
            id="code"
            type="text"
            placeholder="123456"
            autoComplete="one-time-code"
            disabled={resetForm.formState.isSubmitting}
            className="h-10 tracking-widest font-mono"
            {...resetForm.register('code')}
          />
          {resetForm.formState.errors.code && (
            <p className="text-sm text-destructive">{resetForm.formState.errors.code.message}</p>
          )}
        </div>

        <FormField
          control={resetForm.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="newPassword" className="text-sm font-medium">New password</Label>
              <FormControl>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={resetForm.formState.isSubmitting}
                  className="h-10"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={resetForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
              <FormControl>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={resetForm.formState.isSubmitting}
                  className="h-10"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full h-10" disabled={resetForm.formState.isSubmitting}>
          {resetForm.formState.isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting password…</>
          ) : (
            'Reset Password'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{' '}
          <button
            type="button"
            onClick={() => { setStep('email'); setServerError(null); }}
            className="text-primary hover:underline cursor-pointer"
          >
            Try again
          </button>
        </p>
      </form>
    </Form>
  );
}
