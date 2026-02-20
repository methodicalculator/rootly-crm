"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  from: Date;
  to: Date;
  onChange: (range: { from: Date; to: Date }) => void;
}

const presets = [
  {
    label: "Oggi",
    range: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Ultimi 7 giorni",
    range: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "Ultimi 30 giorni",
    range: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    label: "Questo mese",
    range: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Mese scorso",
    range: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
];

function formatTriggerLabel(from: Date, to: Date): string {
  const sameMonth =
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear();

  if (sameMonth) {
    return `${from.getDate()} - ${format(to, "d MMM yyyy", { locale: it })}`;
  }
  return `${format(from, "d MMM", { locale: it })} - ${format(to, "d MMM yyyy", { locale: it })}`;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  function handlePreset(preset: (typeof presets)[number]) {
    onChange(preset.range());
    setOpen(false);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    if (range.from && range.to) {
      onChange({ from: range.from, to: range.to });
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal">
          <CalendarDays className="mr-2 h-4 w-4" />
          {formatTriggerLabel(from, to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets */}
          <div className="flex w-40 flex-col gap-1 border-r p-3">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <Calendar
            mode="range"
            selected={{ from, to }}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={it}
            weekStartsOn={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
