import { Plus, X } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { HabitPolarity } from "#graphql/types";
import { addDays, todayIsoDate } from "#lib/dates";
import { type DraftField, draftField } from "#lib/habit-draft";
import { cn } from "#lib/utils";

interface Props {
  polarity: HabitPolarity;
  onPolarity: (polarity: HabitPolarity) => void;
  /** "YYYY-MM-DD" or "" for open-ended. */
  endDate: string;
  onEndDate: (endDate: string) => void;
  customFields: DraftField[];
  onCustomFields: (fields: DraftField[]) => void;
}

const LENGTHS = [7, 30, 90] as const;

/**
 * The parts of a habit beyond name and schedule, shared by the create and
 * edit dialogs: build or avoid ("no sugar"), an optional last day for a
 * time-boxed habit, and the user's own labelled fields.
 */
export function HabitExtraFields({
  polarity,
  onPolarity,
  endDate,
  onEndDate,
  customFields,
  onCustomFields,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const setField = (index: number, patch: Partial<DraftField>) =>
    onCustomFields(customFields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("habits.edit.polarity")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["BUILD", "AVOID"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={polarity === value ? "default" : "outline"}
              aria-pressed={polarity === value}
              onClick={() => onPolarity(value)}
              className="h-auto flex-col items-start gap-0.5 py-2 text-left"
            >
              <span>{t(`habits.edit.polarityOption.${value}`)}</span>
              <span
                className={cn(
                  "text-xs font-normal",
                  polarity === value ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {t(`habits.edit.polarityHint.${value}`)}
              </span>
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-end`}>
          {t("habits.edit.endDate")}{" "}
          <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <Input
            id={`${id}-end`}
            type="date"
            className="w-auto"
            min={todayIsoDate()}
            aria-describedby={`${id}-end-hint`}
            value={endDate}
            onChange={(e) => onEndDate(e.target.value)}
          />
          {LENGTHS.map((days) => (
            <Button
              key={days}
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => onEndDate(addDays(todayIsoDate(), days - 1))}
            >
              {t("habits.edit.lasts", { count: days })}
            </Button>
          ))}
          {endDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => onEndDate("")}
            >
              {t("habits.edit.noEnd")}
            </Button>
          )}
        </div>
        <p id={`${id}-end-hint`} className="text-xs text-muted-foreground">
          {t("habits.edit.endDateHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("habits.edit.customFields")}</p>
        {customFields.map((field, index) => (
          <div key={field.key} className="flex gap-1.5">
            <Input
              aria-label={t("habits.edit.fieldLabel", { n: index + 1 })}
              placeholder={t("habits.edit.fieldLabelPlaceholder")}
              maxLength={50}
              className="w-36"
              value={field.label}
              onChange={(e) => setField(index, { label: e.target.value })}
            />
            <Input
              aria-label={t("habits.edit.fieldValue", { n: index + 1 })}
              placeholder={t("habits.edit.fieldValuePlaceholder")}
              maxLength={500}
              className="min-w-0 flex-1"
              value={field.value}
              onChange={(e) => setField(index, { value: e.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("habits.edit.removeField", { n: index + 1 })}
              onClick={() => onCustomFields(customFields.filter((_, i) => i !== index))}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          disabled={customFields.length >= 20}
          onClick={() => onCustomFields([...customFields, draftField()])}
        >
          <Plus className="size-4" /> {t("habits.edit.addField")}
        </Button>
      </div>
    </>
  );
}
