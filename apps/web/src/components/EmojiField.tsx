import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { cn } from "#lib/utils";

/** One tap for the usual picks; anything else can be typed or pasted (the OS emoji keyboard works too). */
const SUGGESTED = [
  "💧",
  "📚",
  "🏃",
  "🧘",
  "🚶",
  "✍️",
  "🤸",
  "🗣️",
  "💪",
  "🥗",
  "😴",
  "🦷",
  "💊",
  "🎸",
  "🎨",
  "💻",
  "🧹",
  "🌱",
  "☀️",
  "🚭",
  "🍬",
  "📵",
  "💰",
  "❤️",
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
}

/** An emoji for a habit: a small text field and a row of suggestions. */
export function EmojiField({ value, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("habits.edit.icon")}</Label>
      <div className="flex flex-wrap items-center gap-1">
        <Input
          id={id}
          value={value}
          maxLength={16}
          placeholder="🙂"
          className="mr-1 w-14 text-center"
          onChange={(e) => onChange(e.target.value)}
        />
        {SUGGESTED.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={t("habits.edit.useIcon", { icon: emoji })}
            aria-pressed={value === emoji}
            onClick={() => onChange(value === emoji ? "" : emoji)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-base hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === emoji && "bg-accent ring-1 ring-foreground/30",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
