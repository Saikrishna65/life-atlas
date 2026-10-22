"use client";

import React, { useState, useRef, useEffect, forwardRef, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  options?: SelectOption[];
  placeholder?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      className = "",
      containerClassName = "",
      children,
      options: propOptions,
      id,
      name,
      value,
      defaultValue,
      disabled = false,
      placeholder = "Select an option",
      onChange,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : autoId);

    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);

    // Parse options from props or children
    const parsedOptions = React.useMemo(() => {
      if (propOptions && propOptions.length > 0) {
        return propOptions;
      }
      const opts: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          const childProps = child.props as { value?: string | number; children?: React.ReactNode };
          if (childProps.value !== undefined) {
            let labelText = "";
            if (typeof childProps.children === "string") {
              labelText = childProps.children;
            } else if (Array.isArray(childProps.children)) {
              labelText = childProps.children.join("");
            } else {
              labelText = String(childProps.value);
            }
            opts.push({
              value: childProps.value,
              label: labelText,
            });
          }
        }
      });
      return opts;
    }, [propOptions, children]);

    // Track internal selected value if uncontrolled
    const initialVal =
      value !== undefined
        ? Array.isArray(value)
          ? String(value[0] ?? "")
          : (value as string | number)
        : defaultValue !== undefined
        ? Array.isArray(defaultValue)
          ? String(defaultValue[0] ?? "")
          : (defaultValue as string | number)
        : parsedOptions[0]?.value ?? "";

    const [internalValue, setInternalValue] = useState<string | number>(initialVal);

    const rawCurrent = value !== undefined ? (Array.isArray(value) ? value[0] : value) : internalValue;
    const currentValue = rawCurrent as string | number;

    const currentOption = parsedOptions.find((opt) => String(opt.value) === String(currentValue));

    // Close on click outside or touch
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen]);

    const handleSelectOption = (optValue: string | number) => {
      if (disabled) return;
      setInternalValue(optValue);
      setIsOpen(false);

      if (onChange) {
        onChange({
          target: {
            value: String(optValue),
            name,
          },
        });
      }

      // Also trigger change on native select ref if passed
      if (hiddenSelectRef.current) {
        hiddenSelectRef.current.value = String(optValue);
        hiddenSelectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    return (
      <div ref={containerRef} className={`space-y-1.5 w-full text-left relative ${containerClassName}`}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-sans font-medium text-foreground tracking-wide block">
            {label}
          </label>
        )}

        {/* Custom styled trigger button */}
        <div className="relative">
          <button
            type="button"
            id={selectId}
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={`w-full flex items-center justify-between text-left bg-surface border text-foreground text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 cursor-pointer shadow-xs select-none ${
              isOpen
                ? "border-accent ring-2 ring-accent/20 bg-background"
                : error
                ? "border-rose-400 focus:border-rose-500"
                : "border-muted hover:border-foreground/30 focus:border-accent"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
          >
            <div className="flex items-center gap-2 truncate pr-2">
              {currentOption?.icon && <span className="shrink-0">{currentOption.icon}</span>}
              <span className={`truncate ${!currentOption ? "text-muted-foreground" : "font-normal"}`}>
                {currentOption ? currentOption.label : placeholder}
              </span>
            </div>

            <div className="flex items-center shrink-0 text-muted-foreground">
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-accent" : ""}`}
              />
            </div>
          </button>

          {/* Custom Designed Dropdown Menu Popover */}
          {isOpen && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-surface/98 border border-muted/80 backdrop-blur-md shadow-2xl p-1.5 space-y-0.5 max-h-60 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150"
            >
              {parsedOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">No options available</div>
              ) : (
                parsedOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(currentValue);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectOption(opt.value)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-sans flex items-center justify-between transition-all duration-150 cursor-pointer group ${
                        isSelected
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-foreground/90 hover:bg-surface-hover hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-accent shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Hidden native select for form accessibility and DOM compatibility */}
        <select
          ref={(node) => {
            hiddenSelectRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
          }}
          name={name}
          value={String(currentValue)}
          onChange={(e) => handleSelectOption(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none"
          {...props}
        >
          {parsedOptions.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p className="text-[11px] text-rose-500 font-sans mt-0.5">{error}</p>}
        {hint && !error && <p className="text-[11px] text-muted-foreground font-sans mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
