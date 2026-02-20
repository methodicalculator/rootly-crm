"use client";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";

export function AutoRefresh() {
  useAutoRefresh();
  return null;
}
