'use client';

import { useState, useMemo } from 'react';
import {
  Pencil,
  Trash2,
  UserPlus,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { CognitoUser } from '@alliance-risk/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers, useDeleteUser } from '@/hooks/use-users';
import { CreateUserModal } from './create-user-modal';
import { EditUserModal } from './edit-user-modal';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800 border-violet-200',
  user: 'bg-blue-100 text-blue-800 border-blue-200',
};

function getRoleLabel(user: CognitoUser): string {
  if (user.isAdmin || user.groups.includes('admin')) return 'Admin';
  return 'User';
}

function getRoleBadgeClass(user: CognitoUser): string {
  const role = getRoleLabel(user).toLowerCase();
  return ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

function UserAvatar({ email }: { email: string }) {
  const initials = email
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </span>
  );
}

interface DeleteConfirmDialogProps {
  user: CognitoUser | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeleteConfirmDialog({
  user,
  onConfirm,
  onCancel,
  isLoading,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-medium text-foreground">{user?.email}</span>? This
          action cannot be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Server-side cursor pagination: stack of nextTokens for each page visited.
  // cursors[0] = undefined (first page), cursors[1] = token for page 2, etc.
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const currentCursorIndex = cursors.length - 1;
  const currentCursor = cursors[currentCursorIndex];

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<CognitoUser | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<CognitoUser | null>(null);

  // Fetch one page of up to 60 users from Cognito via the current cursor.
  const { data, isLoading, isError } = useUsers(60, currentCursor);
  const deleteUser = useDeleteUser();

  const hasNextPage = !!data?.nextToken;
  const hasPrevPage = currentCursorIndex > 0;

  // Client-side filtering applied to the current page only.
  const filteredUsers = useMemo(() => {
    const users = data?.users ?? [];
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase());

      const role = getRoleLabel(u).toLowerCase();
      const matchesRole = roleFilter === 'all' || role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.enabled) ||
        (statusFilter === 'inactive' && !u.enabled);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [data, searchQuery, roleFilter, statusFilter]);

  const handleNextPage = () => {
    if (data?.nextToken) {
      setCursors((prev) => [...prev, data.nextToken]);
    }
  };

  const handlePrevPage = () => {
    setCursors((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const resetCursors = () => setCursors([undefined]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    resetCursors();
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value as 'all' | 'admin' | 'user');
    resetCursors();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as 'all' | 'active' | 'inactive');
    resetCursors();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalUser) return;
    try {
      await deleteUser.mutateAsync(deleteModalUser.username);
      setDeleteModalUser(null);
      // If editing same user, close edit modal too
      if (editModalUser?.username === deleteModalUser.username) {
        setEditModalUser(null);
      }
    } catch {
      // Error surfaced via react-query
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage platform users and their permissions
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Failed to load users. Please try again.
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.username}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar email={user.email} />
                      <div>
                        <p className="text-sm font-medium leading-none">
                          {user.attributes?.name ?? user.username}
                        </p>
                        {user.lastModifiedDate && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Last login:{' '}
                            {new Date(user.lastModifiedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getRoleBadgeClass(user)}`}
                    >
                      {getRoleLabel(user)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.enabled ? 'default' : 'secondary'}
                      className={`text-xs ${
                        user.enabled
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {user.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit ${user.email}`}
                        onClick={() => setEditModalUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${user.email}`}
                        onClick={() => setDeleteModalUser(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && (hasPrevPage || hasNextPage || filteredUsers.length > 0) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredUsers.length === 0
              ? 'No results on this page'
              : `Showing ${filteredUsers.length} result${filteredUsers.length !== 1 ? 's' : ''} — page ${currentCursorIndex + 1}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevPage}
              disabled={!hasPrevPage}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-medium">{currentCursorIndex + 1}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={!hasNextPage}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateUserModal open={createModalOpen} onOpenChange={setCreateModalOpen} />

      <EditUserModal
        user={editModalUser}
        open={!!editModalUser}
        onOpenChange={(open) => { if (!open) setEditModalUser(null); }}
        onDeleteRequest={(u) => setDeleteModalUser(u)}
      />

      <DeleteConfirmDialog
        user={deleteModalUser}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalUser(null)}
        isLoading={deleteUser.isPending}
      />
    </div>
  );
}
