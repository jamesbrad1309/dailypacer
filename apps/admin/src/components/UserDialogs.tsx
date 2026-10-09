import { type FormEvent, useState } from "react";
import { ErrorPanel } from "#components/ErrorPanel";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { UserRole } from "#graphql/types";
import type { DescribedError } from "#lib/errors";
import { PASSWORD_MIN_LENGTH } from "#lib/session";

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const ROLE_HINTS: Record<UserRole, string> = {
  OWNER: "Everything, including managing admins",
  ADMIN: "Manages members and viewers, opens the admin",
  MEMBER: "Full use of the app",
  VIEWER: "Read-only in the app",
};

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/** Checks what the API would refuse, so the dialog can say so before sending. */
export function newUserProblems(user: NewUser): Partial<Record<keyof NewUser, string>> {
  const problems: Partial<Record<keyof NewUser, string>> = {};
  if (!user.name.trim()) problems.name = "Enter a name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim()))
    problems.email = "Enter a valid email address.";
  if (user.password.length < PASSWORD_MIN_LENGTH) {
    problems.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return problems;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Adds someone who can sign in straight away, with the role picked here. */
export function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  pending,
  error,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roles the signed-in user may give (their abilities). */
  roles: UserRole[];
  pending: boolean;
  error: DescribedError | null;
  onCreate: (user: NewUser) => Promise<boolean>;
}) {
  const [problems, setProblems] = useState<ReturnType<typeof newUserProblems>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const user: NewUser = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role")) as UserRole,
    };
    const found = newUserProblems(user);
    setProblems(found);
    if (Object.keys(found).length) return;
    if (await onCreate(user)) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setProblems({});
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              They can sign in straight away. Share the password with them; they can change it from
              the app's account menu.
            </DialogDescription>
          </DialogHeader>
          {error && <ErrorPanel compact error={error} />}
          <div className="grid gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              name="name"
              autoFocus
              aria-invalid={problems.name ? true : undefined}
              aria-describedby="new-name-error"
            />
            <FieldError id="new-name-error" message={problems.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="off"
              aria-invalid={problems.email ? true : undefined}
              aria-describedby="new-email-error"
            />
            <FieldError id="new-email-error" message={problems.email} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={problems.password ? true : undefined}
              aria-describedby="new-password-error"
            />
            <FieldError id="new-password-error" message={problems.password} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-role">Role</Label>
            <select
              id="new-role"
              name="role"
              defaultValue={roles.includes("MEMBER") ? "MEMBER" : roles[0]}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}: {ROLE_HINTS[role]}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Sets a new password for someone and signs them out everywhere. */
export function ResetPasswordDialog({
  user,
  onClose,
  pending,
  error,
  onReset,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
  pending: boolean;
  error: DescribedError | null;
  onReset: (password: string) => Promise<boolean>;
}) {
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < PASSWORD_MIN_LENGTH) {
      return setProblem(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
    setProblem(null);
    if (await onReset(password)) onClose();
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          setProblem(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reset {user?.name}'s password</DialogTitle>
            <DialogDescription>
              They're signed out everywhere and sign in again with this password.
            </DialogDescription>
          </DialogHeader>
          {error && <ErrorPanel compact error={error} />}
          <div className="grid gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={problem ? true : undefined}
              aria-describedby="reset-password-error"
            />
            <FieldError id="reset-password-error" message={problem ?? undefined} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
