'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserCheck, UserX, KeyRound, Trash2 } from 'lucide-react';
import type { CognitoUser } from '@alliance-risk/shared';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useUpdateUser,
  useEnableUser,
  useDisableUser,
  useResetUserPassword,
  useAddUserToGroup,
  useRemoveUserFromGroup,
  useGroups,
} from '@/hooks/use-users';

const editUserSchema = z.object({
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  name: z.string().optional(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
  user: CognitoUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteRequest?: (user: CognitoUser) => void;
}

export function EditUserModal({
  user,
  open,
  onOpenChange,
  onDeleteRequest,
}: EditUserModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const updateUser = useUpdateUser();
  const enableUser = useEnableUser();
  const disableUser = useDisableUser();
  const resetPassword = useResetUserPassword();
  const addToGroup = useAddUserToGroup();
  const removeFromGroup = useRemoveUserFromGroup();
  const { data: groupsData } = useGroups();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    values: {
      email: user?.email ?? '',
      name: user?.attributes?.name ?? '',
    },
  });

  if (!user) return null;

  const onSubmit = async (values: EditUserFormValues) => {
    setServerError(null);
    try {
      const payload: Record<string, string> = {};
      if (values.email && values.email !== user.email) payload.email = values.email;
      if (values.name !== undefined) payload.name = values.name;

      if (Object.keys(payload).length > 0) {
        await updateUser.mutateAsync({ username: user.username, payload });
      }
      setActionMessage('User updated successfully.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update user.';
      setServerError(msg);
    }
  };

  const handleToggleEnable = async () => {
    setServerError(null);
    setActionMessage(null);
    try {
      if (user.enabled) {
        await disableUser.mutateAsync(user.username);
        setActionMessage('User disabled.');
      } else {
        await enableUser.mutateAsync(user.username);
        setActionMessage('User enabled.');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Action failed.';
      setServerError(msg);
    }
  };

  const handleResetPassword = async () => {
    setServerError(null);
    setActionMessage(null);
    try {
      await resetPassword.mutateAsync(user.username);
      setActionMessage('Password reset email sent.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to reset password.';
      setServerError(msg);
    }
  };

  const handleGroupToggle = async (groupName: string) => {
    setServerError(null);
    setActionMessage(null);
    try {
      if (user.groups.includes(groupName)) {
        await removeFromGroup.mutateAsync({ username: user.username, groupName });
        setActionMessage(`Removed from ${groupName}.`);
      } else {
        await addToGroup.mutateAsync({ username: user.username, groupName });
        setActionMessage(`Added to ${groupName}.`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Group action failed.';
      setServerError(msg);
    }
  };

  const availableGroups = groupsData?.groups ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          {actionMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </div>
          )}

          {/* User identity info */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium">{user.username}</p>
            <p className="text-muted-foreground">
              Status:{' '}
              <span
                className={
                  user.enabled
                    ? 'text-emerald-600 font-medium'
                    : 'text-destructive font-medium'
                }
              >
                {user.userStatus}
              </span>
            </p>
          </div>

          {/* Edit attributes form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email address</Label>
              <Input
                id="edit-email"
                type="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Display name</Label>
              <Input id="edit-name" type="text" {...register('name')} />
            </div>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>

          <Separator />

          {/* Group management */}
          {availableGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Groups</p>
              <div className="flex flex-wrap gap-2">
                {availableGroups.map((group) => {
                  const isMember = user.groups.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => handleGroupToggle(group)}
                      className="cursor-pointer focus:outline-none"
                      aria-label={
                        isMember
                          ? `Remove from ${group} group`
                          : `Add to ${group} group`
                      }
                    >
                      <Badge
                        variant={isMember ? 'default' : 'outline'}
                        className="transition-opacity hover:opacity-75"
                      >
                        {group}
                        {isMember ? ' ×' : ' +'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Danger zone actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleToggleEnable}
              disabled={
                enableUser.isPending ||
                disableUser.isPending ||
                resetPassword.isPending
              }
            >
              {user.enabled ? (
                <>
                  <UserX className="mr-1.5 h-4 w-4" />
                  Disable User
                </>
              ) : (
                <>
                  <UserCheck className="mr-1.5 h-4 w-4" />
                  Enable User
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleResetPassword}
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="mr-1.5 h-4 w-4" />
              )}
              Reset Password
            </Button>

            {onDeleteRequest && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onDeleteRequest(user)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete User
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
