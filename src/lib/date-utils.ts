const romeDateFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome",
});

/**
 * Returns YYYY-MM-DD in Europe/Rome timezone.
 * Works both client-side (browser) and server-side (Node.js).
 */
export function toRomeDateStr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return romeDateFmt.format(d);
}

/**
 * Returns YYYY-MM in Europe/Rome timezone.
 */
export function toRomeMonthStr(date: Date | string): string {
  return toRomeDateStr(date).slice(0, 7);
}

/**
 * Returns ISO timestamp for midnight in Europe/Rome on a given YYYY-MM-DD date.
 * Handles CET (+01:00) / CEST (+02:00) automatically.
 */
export function romeMidnightUTC(dateStr: string): string {
  // Try CET first (covers Oct–Mar)
  const cetCandidate = new Date(`${dateStr}T00:00:00+01:00`);
  if (toRomeDateStr(cetCandidate) === dateStr) {
    return cetCandidate.toISOString();
  }
  // CEST (covers Mar–Oct)
  return new Date(`${dateStr}T00:00:00+02:00`).toISOString();
}

/**
 * Returns ISO timestamp for a specific date + time in Europe/Rome.
 * dateStr: "YYYY-MM-DD", timeStr: "HH:mm"
 */
export function toRomeTimestamp(dateStr: string, timeStr: string): string {
  // Try CET first (+01:00, covers Oct–Mar)
  const cetCandidate = new Date(`${dateStr}T${timeStr}:00+01:00`);
  if (toRomeDateStr(cetCandidate) === dateStr) {
    return cetCandidate.toISOString();
  }
  // CEST (+02:00, covers Mar–Oct)
  return new Date(`${dateStr}T${timeStr}:00+02:00`).toISOString();
}

/**
 * Returns ISO timestamp for midnight on the 1st of the current month in Europe/Rome.
 */
export function startOfMonthRomeISO(now?: Date): string {
  const romeDate = toRomeDateStr(now ?? new Date());
  const firstOfMonth = romeDate.slice(0, 8) + "01";
  return romeMidnightUTC(firstOfMonth);
}
