import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className = "", containerClassName = "", children, options, id, ...props }, ref) => {
    const generatedId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className={`space-y-1.5 w-full text-left ${containerClassName}`}>
        {label && (
          <label htmlFor={generatedId} className="text-xs font-sans font-medium text-foreground tracking-wide block">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={generatedId}
            className={`w-full appearance-none bg-surface border text-foreground text-xs sm:text-sm rounded-xl px-3.5 py-2.5 pr-10 focus:border-accent focus:bg-background focus:ring-1 focus:ring-accent/20 outline-hidden transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              error ? "border-rose-400" : "border-muted hover:border-foreground/20"
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
            <ChevronDown className="w-4 h-4 shrink-0 transition-transform" />
          </div>
        </div>
        {error && <p className="text-[11px] text-rose-500 font-sans mt-0.5">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground font-sans mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
