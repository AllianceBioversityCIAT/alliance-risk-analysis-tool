'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateUser } from '@/hooks/use-users';

const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  temporaryPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  sendWelcomeEmail: z.boolean(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const createUser = useCreateUser();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { sendWelcomeEmail: true },
  });

  const sendWelcomeEmail = watch('sendWelcomeEmail');

  const onSubmit = async (values: CreateUserFormValues) => {
    setServerError(null);
    try {
      await createUser.mutateAsync({
        email: values.email.toLowerCase().trim(),
        temporaryPassword: values.temporaryPassword,
        sendWelcomeEmail: values.sendWelcomeEmail,
      });
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create user. Please try again.';
      setServerError(msg);
    }
  };

  const handleClose = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email address</Label>
            <Input
              id="create-email"
              type="email"
              placeholder="user@example.com"
              autoComplete="off"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-temp-password">Temporary password</Label>
            <Input
              id="create-temp-password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('temporaryPassword')}
            />
            {errors.temporaryPassword && (
              <p className="text-destructive text-sm">{errors.temporaryPassword.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Send welcome email</p>
              <p className="text-xs text-muted-foreground">
                Notify the user with login instructions
              </p>
            </div>
            <Switch
              id="send-welcome-email"
              checked={sendWelcomeEmail}
              onCheckedChange={(checked) => setValue('sendWelcomeEmail', checked)}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
