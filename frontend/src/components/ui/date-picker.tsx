import * as React from "react";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string; // stored as YYYY-MM-DD or DD-MM-YYYY
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

/**
 * Parses either DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD into a Date object.
 */
export function parseDate(val?: string): Date | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
    const delimiter = trimmed.includes("-") ? "-" : "/";
    const d = parse(trimmed, `dd${delimiter}MM${delimiter}yyyy`, new Date());
    return isNaN(d.getTime()) ? undefined : d;
  }
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
    const delimiter = trimmed.includes("-") ? "-" : "/";
    const d = parse(trimmed, `yyyy${delimiter}MM${delimiter}dd`, new Date());
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * Formats any date string or Date object into DD-MM-YYYY display format.
 */
export function formatDateDisplay(val?: string | Date | null): string {
  if (!val) return "—";
  if (val instanceof Date) {
    return format(val, "dd-MM-yyyy");
  }
  const d = parseDate(val);
  return d ? format(d, "dd-MM-yyyy") : val;
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = "dd-mm-yyyy",
  className,
  id,
  name,
  required,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Maintain local text representation for typing dd-mm-yyyy
  const [textValue, setTextValue] = React.useState(() => {
    const d = parseDate(value);
    return d ? format(d, "dd-MM-yyyy") : value;
  });

  React.useEffect(() => {
    const d = parseDate(value);
    setTextValue(d ? format(d, "dd-MM-yyyy") : value);
  }, [value]);

  const selectedDate = parseDate(value);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTextValue(val);

    if (!val.trim()) {
      onChange("");
      return;
    }

    const parsed = parseDate(val);
    if (parsed) {
      // Pass ISO format YYYY-MM-DD to backend queries/forms
      onChange(format(parsed, "yyyy-MM-dd"));
    }
  }

  function handleDateSelect(date?: Date) {
    if (date) {
      const iso = format(date, "yyyy-MM-dd");
      setTextValue(format(date, "dd-MM-yyyy"));
      onChange(iso);
    } else {
      setTextValue("");
      onChange("");
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setTextValue("");
    onChange("");
  }

  return (
    <div className={cn("relative inline-flex items-center w-full", className)}>
      <input
        type="text"
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        value={textValue}
        onChange={handleTextChange}
        className="h-9 w-full min-w-[135px] rounded-md border border-input bg-card pl-2.5 pr-11 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="absolute right-1 flex items-center gap-0.5 sm:gap-1">
        {textValue && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              aria-label="Pick date from calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border border-border bg-card shadow-lg z-50" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
