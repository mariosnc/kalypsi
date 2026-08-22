export function isWeekend(d: Date) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// Inclusive count of Mon–Fri days between two ISO date strings (YYYY-MM-DD)
export function workingDaysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (!isWeekend(cur)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
