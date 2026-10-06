import { useMutation } from "@apollo/client/react";
import { Settings } from "lucide-react";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { HabitExtraFields } from "#components/HabitExtraFields";
import { ScheduleEditor } from "#components/ScheduleEditor";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { Textarea } from "#components/ui/textarea";
import { DASHBOARD_STATS_QUERY, HABITS_QUERY, UPDATE_HABIT_MUTATION } from "#graphql/habits";
import type { Habit } from "#graphql/types";
import {
  type HabitDraft,
  type HabitDraftAction,
  cleanCustomFields,
  habitDraftFrom,
  habitDraftReducer,
} from "#lib/habit-draft";
import { parseTags } from "#lib/tags";

export function EditHabitDialog({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, dispatch] = useReducer(habitDraftReducer, habit, habitDraftFrom);
  const set = <K extends keyof HabitDraft>(field: K, value: HabitDraft[K]) =>
    dispatch({ type: "set", field, value } as HabitDraftAction);
  const { name, description, tags, unit, targetValue, startTime, schedule } = draft;

  const [updateHabit, { loading }] = useMutation(UPDATE_HABIT_MUTATION, {
    // A schedule change moves which days count as missed (HabitRecords).
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }, "HabitRecords"],
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset the form to the habit's current values each time it's opened,
      // so a cancelled edit never leaves stale draft state for next time.
      dispatch({ type: "reset", draft: habitDraftFrom(habit) });
    }
    setOpen(next);
  }

  async function handleSave() {
    await updateHabit({
      variables: {
        id: habit.id,
        input: {
          name: name.trim() || habit.name,
          description: description.trim() || null,
          tags: parseTags(tags),
          unit: unit.trim() || null,
          targetValue: targetValue.trim() === "" ? null : Number(targetValue),
          startTime: startTime === "" ? null : startTime,
          schedule,
          polarity: draft.polarity,
          endDate: draft.endDate || null,
          customFields: cleanCustomFields(draft.customFields),
        },
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="size-3.5" /> {t("common.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("habits.edit.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">{t("habits.edit.name")}</Label>
            <Input id="edit-name" value={name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">{t("habits.edit.description")}</Label>
            <Textarea
              id="edit-description"
              rows={2}
              maxLength={500}
              placeholder={t("habits.edit.descriptionPlaceholder")}
              value={description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-tags">{t("habits.edit.tags")}</Label>
            <Input
              id="edit-tags"
              placeholder={t("habits.edit.tagsPlaceholder")}
              value={tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-unit">{t("habits.edit.unit")}</Label>
              <Input
                id="edit-unit"
                placeholder={t("habits.edit.unitPlaceholder")}
                value={unit}
                onChange={(e) => set("unit", e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-target">{t("habits.edit.target")}</Label>
              <Input
                id="edit-target"
                type="number"
                value={targetValue}
                onChange={(e) => set("targetValue", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-start-time">{t("habits.edit.startTime")}</Label>
            <Input
              id="edit-start-time"
              type="time"
              value={startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>

          <ScheduleEditor value={schedule} onChange={(value) => set("schedule", value)} />

          <HabitExtraFields
            polarity={draft.polarity}
            onPolarity={draft.financeSource ? undefined : (value) => set("polarity", value)}
            endDate={draft.endDate}
            onEndDate={(value) => set("endDate", value)}
            customFields={draft.customFields}
            onCustomFields={(value) => set("customFields", value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
