import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & {
    size?: "sm" | "default" | "lg";
  }
>(({ className, type, size = "default", ...props }, ref) => {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:bg-muted flex w-full rounded-lg border bg-input-background px-3 py-2 font-normal transition-all file:border-0 file:bg-transparent file:font-medium focus-visible:outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-10 data-[size=lg]:h-12 data-[size=sm]:h-8 data-[size=lg]:text-base data-[size=sm]:text-sm shadow-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };