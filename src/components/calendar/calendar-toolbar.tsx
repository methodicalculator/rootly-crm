"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ToolbarProps, View } from "react-big-calendar";

const VIEW_LABELS: Record<string, string> = {
  week: "Settimana",
  month: "Mese",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CalendarToolbar(props: ToolbarProps<any, any>) {
  const { label, onNavigate, onView, view } = props;

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

      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {(["week", "month"] as View[]).map((v) => (
          <Button
            key={v}
            variant={view === v ? "default" : "ghost"}
            size="sm"
            onClick={() => onView(v)}
            className="text-xs"
          >
            {VIEW_LABELS[v]}
          </Button>
        ))}
      </div>
    </div>
  );
}
