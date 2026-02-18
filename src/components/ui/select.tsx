import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-white/65 bg-white/80 px-3 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-emerald-100",
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };
