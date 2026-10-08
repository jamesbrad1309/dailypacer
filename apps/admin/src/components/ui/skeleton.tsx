import type * as React from "react";
import { cn } from "#lib/utils";

/** A placeholder block for content that's still loading. Pulses only when motion is allowed. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
