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
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(undefined);
  const [showMobileCalendar, setShowMobileCalendar] = React.useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTempRange(undefined);
      setShowMobileCalendar(false);
    }
    setOpen(nextOpen);
  }

  function handlePreset(preset: (typeof presets)[number]) {
    onChange(preset.range());
    setOpen(false);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    setTempRange(range);
    if (range.from && range.to) {
      onChange({ from: range.from, to: range.to });
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal">
          <CalendarDays className="mr-2 h-4 w-4" />
          {formatTriggerLabel(from, to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="end" collisionPadding={16}>
        {/* Desktop: side-by-side presets + 2-month calendar */}
        <div className="hidden sm:flex">
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
          <Calendar
            mode="range"
            selected={tempRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={it}
            weekStartsOn={1}
            min={1}
          />
        </div>

        {/* Mobile: presets only + "Personalizzato" toggle for 1-month calendar */}
        <div className="sm:hidden">
          <div className="flex flex-col gap-0.5 p-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-sm"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant={showMobileCalendar ? "secondary" : "ghost"}
              size="sm"
              className="justify-start text-sm"
              onClick={() => setShowMobileCalendar(!showMobileCalendar)}
            >
              Personalizzato...
            </Button>
          </div>
          {showMobileCalendar && (
            <div className="border-t px-1 pb-2">
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={1}
                locale={it}
                weekStartsOn={1}
                min={1}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
