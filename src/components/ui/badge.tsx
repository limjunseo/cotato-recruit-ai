import type React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}
