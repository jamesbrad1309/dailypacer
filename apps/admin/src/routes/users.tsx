import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { ActionError, PageHeader } from "#components/PageHeader";
import { PageSkeleton } from "#components/RouteStatus";
import {
  CreateUserDialog,
  type NewUser,
  ResetPasswordDialog,
  ROLE_LABELS,
} from "#components/UserDialogs";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#components/ui/table";
import {
  ADMIN_USERS_QUERY,
  CREATE_USER_MUTATION,
  RESET_PASSWORD_MUTATION,
  UPDATE_USER_MUTATION,
} from "#graphql/auth";
import type { AdminUser, UserRole, UserStatus } from "#graphql/types";
import { formatDate } from "#lib/format";
import { useAction } from "#lib/use-action";
import { useMe } from "#lib/use-me";

export const Route = createFileRoute("/users")({
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_USERS_QUERY, fetchPolicy: "network-only" });
  },
  component: UsersPage,
});

const STATUS_BADGE: Record<
  UserStatus,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  ACTIVE: { label: "Active", variant: "success" },
  PENDING: { label: "Waiting for approval", variant: "warning" },
  DISABLED: { label: "Turned off", variant: "secondary" },
};

const refetch = { refetchQueries: ["AdminUsers"], awaitRefetchQueries: true };

type Dialog = { kind: "create" } | { kind: "reset"; user: AdminUser } | null;

function UsersPage() {
  const me = useMe();
  const { data, error: loadError } = useQuery<{ users: AdminUser[] }>(ADMIN_USERS_QUERY);
  const [createUser] = useMutation(CREATE_USER_MUTATION, refetch);
  const [updateUser] = useMutation(UPDATE_USER_MUTATION, refetch);
  const [resetPassword] = useMutation(RESET_PASSWORD_MUTATION);
  const { run, pending, error, dismiss } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  if (loadError) throw loadError;
  if (!data || !me) return <PageSkeleton />;

  const roles = me.abilities.assignableRoles;
  const waiting = data.users.filter((u) => u.status === "PENDING").length;
  const update = (user: AdminUser, input: { role?: UserRole; status?: UserStatus }, key: string) =>
    run(`${key}:${user.id}`, () => updateUser({ variables: { id: user.id, input } }));

  return (
    <>
      <PageHeader
        title="Users"
        description={
          waiting
            ? `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting for approval. Everyone signed in shares the same data.`
            : "Everyone signed in shares the same data; roles decide what each person may do."
        }
        actions={
          me.abilities.manageUsers && (
            <Button onClick={() => setDialog({ kind: "create" })}>
              <UserPlus className="size-4" aria-hidden />
              Add user
            </Button>
          )
        }
      />
      {/* Errors from the dialogs show in the dialogs. */}
      <ActionError error={dialog ? null : error} onDismiss={dismiss} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last signed in</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.users.map((user) => {
            const status = STATUS_BADGE[user.status];
            return (
              <TableRow key={user.id}>
                <TableCell>
                  <p className="font-medium">
                    {user.name}
                    {user.isSelf && <span className="ml-1 text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell>
                  {user.permissions.changeRole ? (
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      disabled={pending !== null}
                      onChange={(event) =>
                        update(user, { role: event.target.value as UserRole }, "role")
                      }
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      {/* Their current role stays listed even if you couldn't give it. */}
                      {[...new Set([user.role, ...roles])].map((role) => (
                        <option key={role} value={role} disabled={!roles.includes(role)}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[user.role]
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>{user.lastSignInAt ? formatDate(user.lastSignInAt) : "Never"}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {user.permissions.changeStatus && user.status === "PENDING" && (
                    <Button
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => update(user, { status: "ACTIVE" }, "status")}
                    >
                      {pending === `status:${user.id}` ? "Working…" : "Approve"}
                    </Button>
                  )}
                  {user.permissions.resetPassword && user.status !== "PENDING" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending !== null}
                      onClick={() => {
                        dismiss();
                        setDialog({ kind: "reset", user });
                      }}
                    >
                      Reset password
                    </Button>
                  )}
                  {user.permissions.changeStatus && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() =>
                        update(
                          user,
                          { status: user.status === "DISABLED" ? "ACTIVE" : "DISABLED" },
                          "status",
                        )
                      }
                    >
                      {pending === `status:${user.id}` && user.status !== "PENDING"
                        ? "Working…"
                        : user.status === "DISABLED"
                          ? "Turn on"
                          : user.status === "PENDING"
                            ? "Decline"
                            : "Turn off"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <CreateUserDialog
        open={dialog?.kind === "create"}
        onOpenChange={(open) => {
          dismiss();
          if (!open) setDialog(null);
        }}
        roles={roles}
        pending={pending === "create"}
        error={dialog?.kind === "create" ? error : null}
        onCreate={async (user: NewUser) =>
          !(await run("create", () => createUser({ variables: { input: user } })))
        }
      />
      <ResetPasswordDialog
        user={dialog?.kind === "reset" ? dialog.user : null}
        onClose={() => {
          dismiss();
          setDialog(null);
        }}
        pending={pending === "reset"}
        error={dialog?.kind === "reset" ? error : null}
        onReset={async (password) =>
          !(await run("reset", () =>
            resetPassword({
              variables: { id: dialog?.kind === "reset" ? dialog.user.id : "", password },
            }),
          ))
        }
      />
    </>
  );
}
