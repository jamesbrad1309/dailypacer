import { useMutation } from "@apollo/client/react";
import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmPrompt } from "#components/todos/ConfirmPrompt";
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
import {
  CREATE_ROUTINE_MUTATION,
  DELETE_ROUTINE_MUTATION,
  UPDATE_ROUTINE_MUTATION,
} from "#graphql/habits";
import type { Habit, Routine } from "#graphql/types";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface State {
  name: string;
  icon: string;
  startTime: string;
  habitIds: string[];
  confirmingDelete: boolean;
  error: string | null;
}

type Action =
  | { [K in keyof State]: { type: "set"; field: K; value: State[K] } }[keyof State]
  | { type: "add"; habitId: string }
  | { type: "remove"; habitId: string }
  | { type: "move"; index: number; by: -1 | 1 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "add":
      return { ...state, habitIds: [...state.habitIds, action.habitId], error: null };
    case "remove":
      return { ...state, habitIds: state.habitIds.filter((id) => id !== action.habitId) };
    case "move": {
      const ids = [...state.habitIds];
      const to = action.index + action.by;
      [ids[action.index], ids[to]] = [ids[to], ids[action.index]];
      return { ...state, habitIds: ids };
    }
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this routine; a new one when left out. */
  routine?: Routine;
  habits: Habit[];
  routines: Routine[];
}

/**
 * Name a routine, set when it happens, and put habits in it in order. A
 * habit already in another routine says so, and moves here if chosen.
 */
export function RoutineDialog({ open, onOpenChange, routine, habits, routines }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RoutineForm
          key={routine?.id ?? "new"}
          routine={routine}
          habits={habits}
          routines={routines}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function RoutineForm({
  routine,
  habits,
  routines,
  onDone,
}: {
  routine?: Routine;
  habits: Habit[];
  routines: Routine[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, {
    name: routine?.name ?? "",
    icon: routine?.icon ?? "",
    startTime: routine?.startTime ?? "",
    habitIds: routine?.habitIds ?? [],
    confirmingDelete: false,
    error: null,
  });
  const set = <K extends keyof State>(field: K, value: State[K]) =>
    dispatch({ type: "set", field, value } as Action);
  const options = { refetchQueries: ["Routines"], awaitRefetchQueries: true };
  const [createRoutine, creating] = useMutation(CREATE_ROUTINE_MUTATION, options);
  const [updateRoutine, updating] = useMutation(UPDATE_ROUTINE_MUTATION, options);
  const [deleteRoutine, deleting] = useMutation(DELETE_ROUTINE_MUTATION, options);

  const byId = new Map(habits.map((h) => [h.id, h]));
  const routineOf = (habitId: string) =>
    routines.find((r) => r.id !== routine?.id && r.habitIds.includes(habitId));
  const available = habits.filter((h) => !state.habitIds.includes(h.id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!state.name.trim()) return set("error", t("habits.routines.nameRequired"));
    if (state.habitIds.length === 0) return set("error", t("habits.routines.needHabit"));
    const input = {
      name: state.name.trim(),
      icon: state.icon.trim() || null,
      startTime: state.startTime || null,
      habitIds: state.habitIds,
    };
    try {
      if (routine) await updateRoutine({ variables: { id: routine.id, input } });
      else await createRoutine({ variables: { input } });
      onDone();
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <DialogContent>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>
            {routine ? t("habits.routines.editTitle") : t("habits.routines.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("habits.routines.hint")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[4.5rem_1fr_7rem] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-icon">{t("habits.routines.icon")}</Label>
            <Input
              id="routine-icon"
              value={state.icon}
              maxLength={16}
              placeholder="🌅"
              className="text-center"
              onChange={(e) => set("icon", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-name">{t("habits.routines.name")}</Label>
            <Input
              id="routine-name"
              value={state.name}
              maxLength={60}
              placeholder={t("habits.routines.namePlaceholder")}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-time">{t("habits.routines.startTime")}</Label>
            <Input
              id="routine-time"
              type="time"
              value={state.startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("habits.routines.habits")}</p>
          {state.habitIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("habits.routines.noHabits")}</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {state.habitIds.map((id, index) => {
                const habit = byId.get(id);
                const name = habit?.name ?? "?";
                return (
                  <li
                    key={id}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm"
                  >
                    <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t("habits.routines.moveUp", { name })}
                      disabled={index === 0}
                      onClick={() => dispatch({ type: "move", index, by: -1 })}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t("habits.routines.moveDown", { name })}
                      disabled={index === state.habitIds.length - 1}
                      onClick={() => dispatch({ type: "move", index, by: 1 })}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t("habits.routines.remove", { name })}
                      onClick={() => dispatch({ type: "remove", habitId: id })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
          {available.length > 0 && (
            <select
              aria-label={t("habits.routines.addHabit")}
              className={selectClass}
              value=""
              onChange={(e) => e.target.value && dispatch({ type: "add", habitId: e.target.value })}
            >
              <option value="">{t("habits.routines.addHabit")}</option>
              {available.map((h) => {
                const other = routineOf(h.id);
                return (
                  <option key={h.id} value={h.id}>
                    {other
                      ? t("habits.routines.inOther", { name: h.name, routine: other.name })
                      : h.name}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        {state.confirmingDelete && routine ? (
          <ConfirmPrompt
            message={t("habits.routines.deletePrompt", { name: routine.name })}
            confirmLabel={t("habits.routines.delete")}
            busy={deleting.loading}
            onCancel={() => set("confirmingDelete", false)}
            onConfirm={async () => {
              await deleteRoutine({ variables: { id: routine.id } });
              onDone();
            }}
          />
        ) : (
          <DialogFooter className="sm:justify-between">
            {routine ? (
              <Button type="button" variant="ghost" onClick={() => set("confirmingDelete", true)}>
                <Trash2 className="size-4" /> {t("habits.routines.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onDone}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={creating.loading || updating.loading}>
                {routine ? t("common.save") : t("habits.routines.create")}
              </Button>
            </div>
          </DialogFooter>
        )}
      </form>
    </DialogContent>
  );
}
