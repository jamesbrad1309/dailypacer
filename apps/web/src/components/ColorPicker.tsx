import { Check } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SWATCH_COLORS } from "#lib/colors";
import { cn } from "#lib/utils";

interface Props {
  /** The picked hex, or null for no colour. */
  value: string | null;
  onChange: (hex: string | null) => void;
}

/** "No colour" plus the swatch palette, as one radio group: arrow keys move between swatches. */
export function ColorPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {t("common.color")}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        <ColorSwatch
          name={id}
          label={t("common.noColor")}
          selected={value === null}
          onSelect={() => onChange(null)}
        />
        {SWATCH_COLORS.map((color) => (
          <ColorSwatch
            key={color.key}
            name={id}
            hex={color.hex}
            label={t(`common.colors.${color.key}`)}
            selected={value?.toLowerCase() === color.hex}
            onSelect={() => onChange(color.hex)}
          />
        ))}
      </div>
    </div>
  );
}

/** A native radio (visually hidden) with the colour as its face. */
function ColorSwatch({
  name,
  hex,
  label,
  selected,
  onSelect,
}: {
  name: string;
  hex?: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label title={label} className="relative cursor-pointer">
      <input
        type="radio"
        name={name}
        className="peer sr-only"
        checked={selected}
        onChange={onSelect}
        aria-label={label}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-8 items-center justify-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          !hex &&
            "bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--color-muted)_4px_8px)]",
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      >
        {selected && <Check className={cn("size-4", hex ? "text-white" : "text-foreground")} />}
      </span>
    </label>
  );
}
