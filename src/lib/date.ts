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

// Ώρες άδειας ανά ημέρα: Δευτέρα = 10 ώρες, Τρίτη–Παρασκευή = 11 ώρες, Σαββατοκύριακο = 0
export function hoursForDate(d: Date): number {
  const day = d.getUTCDay(); // 0=Κυριακή, 1=Δευτέρα, ... 6=Σάββατο
  if (day === 0 || day === 6) return 0;
  if (day === 1) return 10;
  return 11;
}

// Συνολικές ώρες άδειας για ένα εύρος ημερομηνιών (inclusive), με βάση τον παραπάνω κανόνα
export function computeLeaveHours(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  if (e < s) return 0;
  let total = 0;
  const cur = new Date(s);
  while (cur <= e) {
    total += hoursForDate(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return total;
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
