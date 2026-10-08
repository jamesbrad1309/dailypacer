import { Plus, X } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Checkbox } from "#components/ui/checkbox";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { HabitFieldType, HabitPolarity } from "#graphql/types";
import { addDays, todayIsoDate } from "#lib/dates";
import {
  changeFieldType,
  type DraftField,
  draftField,
  fieldIssue,
  parseOptions,
} from "#lib/habit-draft";
import { cn } from "#lib/utils";

interface Props {
  polarity: HabitPolarity;
  /** Omitted: build or avoid is fixed (a finance-linked habit), so it isn't offered. */
  onPolarity?: (polarity: HabitPolarity) => void;
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

  return (
    <>
      {onPolarity && (
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
      )}

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
          <CustomFieldRow
            key={field.key}
            field={field}
            n={index + 1}
            onChange={(next) =>
              onCustomFields(customFields.map((f, i) => (i === index ? next : f)))
            }
            onRemove={() => onCustomFields(customFields.filter((_, i) => i !== index))}
          />
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

const FIELD_TYPES: HabitFieldType[] = ["TEXT", "NUMBER", "BOOLEAN", "SELECT", "DATE"];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** One of the user's fields: its name, what it holds, and a value input that fits. */
function CustomFieldRow({
  field,
  n,
  onChange,
  onRemove,
}: {
  field: DraftField;
  n: number;
  onChange: (field: DraftField) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const issue = fieldIssue(field);
  const set = (patch: Partial<DraftField>) => onChange({ ...field, ...patch });
  const valueLabel = t("habits.edit.fieldValue", { n });

  let input: ReactNode;
  switch (field.type) {
    case "BOOLEAN":
      input = (
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 text-sm">
          <Checkbox
            aria-label={valueLabel}
            checked={field.value === "true"}
            onCheckedChange={(checked) => set({ value: checked === true ? "true" : "false" })}
          />
          <span aria-hidden>
            {t(field.value === "true" ? "habits.edit.yes" : "habits.edit.no")}
          </span>
        </div>
      );
      break;
    case "SELECT":
      input = (
        <select
          aria-label={valueLabel}
          className={cn(selectClass, "min-w-0 flex-1")}
          value={parseOptions(field.options).includes(field.value) ? field.value : ""}
          onChange={(e) => set({ value: e.target.value })}
        >
          <option value="">—</option>
          {parseOptions(field.options).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    default:
      input = (
        <Input
          aria-label={valueLabel}
          aria-invalid={issue === "invalidValue" || undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
          type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
          step={field.type === "NUMBER" ? "any" : undefined}
          placeholder={field.type === "TEXT" ? t("habits.edit.fieldValuePlaceholder") : undefined}
          maxLength={500}
          className="min-w-0 flex-1"
          value={field.value}
          onChange={(e) => set({ value: e.target.value })}
        />
      );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2">
      <div className="flex flex-wrap gap-1.5">
        <Input
          aria-label={t("habits.edit.fieldLabel", { n })}
          placeholder={t("habits.edit.fieldLabelPlaceholder")}
          maxLength={50}
          className="w-36"
          value={field.label}
          onChange={(e) => set({ label: e.target.value })}
        />
        <select
          aria-label={t("habits.edit.fieldType", { n })}
          className={selectClass}
          value={field.type}
          onChange={(e) => onChange(changeFieldType(field, e.target.value as HabitFieldType))}
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`habits.edit.fieldTypes.${type}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto"
          aria-label={t("habits.edit.removeField", { n })}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>
      {field.type === "SELECT" && (
        <Input
          aria-label={t("habits.edit.fieldOptions", { n })}
          aria-invalid={issue === "needsOptions" || undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
          placeholder={t("habits.edit.fieldOptionsPlaceholder")}
          maxLength={1000}
          value={field.options}
          onChange={(e) => set({ options: e.target.value })}
        />
      )}
      <div className="flex">{input}</div>
      {issue && (
        <p id={`${id}-issue`} className="text-xs text-destructive">
          {t(`habits.edit.fieldIssue.${issue}`)}
        </p>
      )}
    </div>
  );
}
