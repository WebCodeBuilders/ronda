"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { inputClasses } from "./Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...props },
  ref,
) {
  const textareaId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium mb-1.5 text-text-primary">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(inputClasses, "resize-none min-h-[80px]", error && "border-error", className)}
        {...props}
      />
      {error && <p className="text-xs mt-1 text-error">{error}</p>}
    </div>
  );
});
