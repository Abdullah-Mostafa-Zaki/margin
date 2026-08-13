'use client';

import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, ArrowUpDown, Trash2, Undo2 } from 'lucide-react';
import { softDeleteUser, restoreUser } from '@/actions/super-admin.actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCairoDate } from "@/lib/date-utils";
import { DeleteConfirmationModal } from './delete-confirmation-modal';

type UserType = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  memberships: { organization: { slug: string } }[];
};

export function UsersTable({ users }: { users: UserType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const term = searchTerm.toLowerCase();
      return (
        (user.name || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term)
      );
    });
  }, [users, searchTerm]);

  const handleDeleteClick = (user: UserType) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!userToDelete || !userToDelete.email) return;
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await softDeleteUser(userToDelete.id, userToDelete.email!);
        toast.success(`User ${userToDelete.email} deleted.`);
        setDeleteModalOpen(false);
      } catch (err: any) {
        toast.error(`Failed to delete: ${err.message}`);
      } finally {
        setIsDeleting(false);
        setUserToDelete(null);
      }
    });
  };

  const handleRestoreClick = (user: UserType) => {
    if (window.confirm(`Are you sure you want to restore ${user.email}?`)) {
      startTransition(async () => {
        try {
          await restoreUser(user.id, user.email!);
          toast.success(`User ${user.email} restored.`);
        } catch (err: any) {
          toast.error(`Failed to restore: ${err.message}`);
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center p-4 pb-0">
        <Input
          placeholder="Filter by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            No users found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Signup Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={user.deletedAt ? "opacity-50 bg-zinc-50" : ""}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name || 'No Name'}</span>
                      <span className="text-sm text-zinc-500">{user.email}</span>
                      {user.deletedAt && (
                        <span className="text-xs text-red-600 font-medium mt-1">Deleted</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.memberships.map((m, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800">
                          {m.organization.slug}
                        </span>
                      ))}
                      {user.memberships.length === 0 && (
                        <span className="text-xs text-zinc-400 italic">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {formatCairoDate(new Date(user.createdAt), "MM/dd/yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {user.deletedAt ? (
                            <DropdownMenuItem onClick={() => handleRestoreClick(user)} disabled={isPending} className="cursor-pointer text-green-600 gap-2">
                              <Undo2 className="h-4 w-4 text-green-500" />
                              Restore User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleDeleteClick(user)} disabled={isPending} className="cursor-pointer text-red-600 gap-2">
                              <Trash2 className="h-4 w-4 text-red-500" />
                              Delete User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete User"
        description="This will instantly log the user out and block them from logging in. Any orphaned organizations they created will remain in the database."
        expectedConfirmationString={userToDelete?.email || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}
