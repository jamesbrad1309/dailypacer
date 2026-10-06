import { useMutation } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { type FormEvent, useEffect, useReducer, useState } from "react";
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
import { CREATE_HABIT_MUTATION, DASHBOARD_STATS_QUERY, HABITS_QUERY } from "#graphql/habits";
import { onAction } from "#lib/command-palette";
import {
  BLANK_HABIT_DRAFT,
  type HabitDraft,
  type HabitDraftAction,
  cleanCustomFields,
  habitDraftReducer,
} from "#lib/habit-draft";
import { HABIT_TEMPLATES, type HabitTemplate } from "#lib/habit-templates";
import { formatTags, parseTags } from "#lib/tags";

export function CreateHabitDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // "New habit" from the command palette lands here and opens the form.
  useEffect(() => onAction("newHabit", () => setOpen(true)), []);
  const [draft, dispatch] = useReducer(habitDraftReducer, BLANK_HABIT_DRAFT);
  const set = <K extends keyof HabitDraft>(field: K, value: HabitDraft[K]) =>
    dispatch({ type: "set", field, value } as HabitDraftAction);
  const { name, description, tags, unit, targetValue, startTime, schedule } = draft;

  const [createHabit, { loading }] = useMutation(CREATE_HABIT_MUTATION, {
    refetchQueries: [{ query: HABITS_QUERY }, { query: DASHBOARD_STATS_QUERY }],
  });

  function applyTemplate(template: HabitTemplate) {
    const words = `habits.templates.${template.id}` as const;
    dispatch({
      type: "reset",
      draft: {
        name: t(`${words}.name`),
        description: t(`${words}.description`),
        unit: t(`${words}.unit`),
        targetValue: template.target?.toString() ?? "",
        startTime: template.startTime ?? "",
        schedule: template.schedule,
        tags: formatTags(template.tags),
        polarity: "BUILD",
        endDate: "",
        customFields: [],
      },
    });
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // Start from a blank form each time, so a cancelled draft doesn't linger.
      dispatch({ type: "reset", draft: BLANK_HABIT_DRAFT });
    }
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createHabit({
      variables: {
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          tags: parseTags(tags),
          unit: unit.trim() || undefined,
          targetValue: targetValue.trim() === "" ? undefined : Number(targetValue),
          startTime: startTime === "" ? undefined : startTime,
          schedule,
          polarity: draft.polarity,
          endDate: draft.endDate || undefined,
          customFields: cleanCustomFields(draft.customFields),
        },
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("habits.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("habits.create.title")}</DialogTitle>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs text-muted-foreground">
              {t("habits.templates.label")}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                >
                  <span aria-hidden className="mr-1">
                    {template.emoji}
                  </span>
                  {t(`habits.templates.${template.id}.name`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-name">{t("habits.edit.name")}</Label>
            <Input
              id="create-name"
              autoFocus
              placeholder={t("habits.newPlaceholder")}
              value={name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-description">{t("habits.edit.description")}</Label>
            <Textarea
              id="create-description"
              rows={2}
              maxLength={500}
              placeholder={t("habits.edit.descriptionPlaceholder")}
              value={description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-tags">{t("habits.edit.tags")}</Label>
            <Input
              id="create-tags"
              placeholder={t("habits.edit.tagsPlaceholder")}
              value={tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="create-unit">{t("habits.edit.unit")}</Label>
              <Input
                id="create-unit"
                placeholder={t("habits.edit.unitPlaceholder")}
                value={unit}
                onChange={(e) => set("unit", e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="create-target">{t("habits.edit.target")}</Label>
              <Input
                id="create-target"
                type="number"
                value={targetValue}
                onChange={(e) => set("targetValue", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-start-time">{t("habits.edit.startTime")}</Label>
            <Input
              id="create-start-time"
              type="time"
              value={startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>

          <ScheduleEditor value={schedule} onChange={(value) => set("schedule", value)} />

          <HabitExtraFields
            polarity={draft.polarity}
            onPolarity={(value) => set("polarity", value)}
            endDate={draft.endDate}
            onEndDate={(value) => set("endDate", value)}
            customFields={draft.customFields}
            onCustomFields={(value) => set("customFields", value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {t("common.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
