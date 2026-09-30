import { useState } from "react";
import { cn } from "#lib/utils";

/** Tailwind backgrounds for the letter fallback; a name always gets the same one. */
const FALLBACK_COLOURS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-fuchsia-600",
];

function colourFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK_COLOURS[Math.abs(hash) % FALLBACK_COLOURS.length];
}

interface Props {
  name: string;
  /** Our own /logos/<domain> URL, or null for a service without a website. */
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "size-6 text-[0.65rem]", md: "size-8 text-xs", lg: "size-10 text-sm" };

/**
 * A service's logo (its website's icon, cached by the API), or its first
 * letter on a colour when there's no website or no icon was found. Purely
 * decorative: the name is always written next to it.
 */
export function ServiceLogo({ name, logoUrl, size = "md", className }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = logoUrl && failedUrl !== logoUrl;
  const box = cn("shrink-0 overflow-hidden rounded-lg", SIZES[size]);

  if (showImage) {
    return (
      // `className` last, so a caller's ring (a charge to confirm) wins over the border ring.
      <span
        className={cn(box, "bg-white ring-1 ring-border dark:bg-white/90", className)}
        aria-hidden
      >
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-0.5"
          onError={() => setFailedUrl(logoUrl)}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "flex items-center justify-center font-semibold text-white",
        colourFor(name),
        className,
      )}
    >
      {name.trim().charAt(0).toLocaleUpperCase() || "?"}
    </span>
  );
}
