// Ομάδες βάρδιας ανά τμήμα
export const MONIATIS_GROUPS = ["Πράσινη", "Ερυθρά", "Κυανή", "Λευκή"];
export const DEFAULT_GROUPS = ["Α", "Β"];

export function groupsForDepartment(dept: string): string[] {
  return dept === "Μονιάτης" ? MONIATIS_GROUPS : DEFAULT_GROUPS;
}

// Το τμήμα Μονιάτης ξεκινά τον κύκλο με τη Λευκή· τα υπόλοιπα με την πρώτη ομάδα τους (Α)
export function defaultStartingGroup(dept: string): string {
  return dept === "Μονιάτης" ? "Λευκή" : DEFAULT_GROUPS[0];
}

export function daysBetweenUTC(a: Date, b: Date): number {
  const ms =
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.round(ms / 86400000);
}

// Υπολογίζει ποια ομάδα (index) δουλεύει σε μια δεδομένη ημερομηνία, με βάση ένα σημείο αναφοράς
export function computeWorkingGroupIndex(
  anchorDate: Date,
  anchorGroupIndex: number,
  targetDate: Date,
  groupCount: number
): number {
  const diff = daysBetweenUTC(anchorDate, targetDate);
  return (((anchorGroupIndex + diff) % groupCount) + groupCount) % groupCount;
}

// Το σύστημα βαρδιών του Μονιάτης: 11ω βάρδια Ημέρας, 24ω εκτός, 13ω βάρδια Νύχτας, 48ω εκτός (κύκλος 96ω = 4 ημέρες).
// Επειδή ο κύκλος είναι ακριβώς 4 ημέρες, ταυτίζεται φυσικά με τις 4 ομάδες:
// η ομάδα που κάνει "βάρδια ημέρας" σήμερα, είναι αυτή που θα κάνει "βάρδια νύχτας" ΑΥΡΙΟ.
// Άρα: ομάδα Νύχτας σήμερα = ομάδα Ημέρας χθες.
export function dayNightGroups(
  anchorDate: Date,
  anchorGroupIndex: number,
  targetDate: Date,
  groups: string[]
): { dayGroup: string; nightGroup: string } {
  const dayIdx = computeWorkingGroupIndex(anchorDate, anchorGroupIndex, targetDate, groups.length);
  const yesterday = new Date(targetDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const nightIdx = computeWorkingGroupIndex(anchorDate, anchorGroupIndex, yesterday, groups.length);
  return { dayGroup: groups[dayIdx], nightGroup: groups[nightIdx] };
}
