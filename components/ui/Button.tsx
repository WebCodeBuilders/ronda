"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/** Las clases viven en `button-styles.ts` para que un `<Link>` pueda verse igual (`buttonClasses`). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth }, className)}
      {...props}
    >
      {children}
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
    </button>
  );
});
