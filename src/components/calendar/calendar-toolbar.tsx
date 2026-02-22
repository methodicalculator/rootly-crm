"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ToolbarProps, View } from "react-big-calendar";

const VIEW_LABELS: Record<string, string> = {
  day: "Giorno",
  week: "Settimana",
  month: "Mese",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CalendarToolbar(props: ToolbarProps<any, any>) {
  const { label, onNavigate, onView, view } = props;

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const viewOptions: View[] = isMobile
    ? ["day"]
    : ["week", "month"];

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onNavigate("PREV")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("TODAY")}>
          Oggi
        </Button>
        <Button variant="outline" size="icon" onClick={() => onNavigate("NEXT")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-base font-semibold capitalize text-foreground">
          {label}
        </span>
      </div>

      {!isMobile && (
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {viewOptions.map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              onClick={() => onView(v)}
              className="text-xs"
            >
              {VIEW_LABELS[v] ?? v}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
