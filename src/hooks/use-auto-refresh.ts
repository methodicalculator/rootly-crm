"use client";

import { useEffect, useRef } from "react";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export function useAutoRefresh() {
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt.current) {
        const elapsed = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (elapsed >= STALE_THRESHOLD_MS) {
          window.location.reload();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
