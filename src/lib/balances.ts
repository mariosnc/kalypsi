export type HourBalances = {
  hoursOvertime: number;
  hoursHolidays: number;
  hoursAnnual: number;
  hoursAccumulated: number;
};

// Αφαιρεί ώρες (Τ.Ω.Π.) με σειρά προτεραιότητας: Υπερωρίες -> Αργίες -> Έτους -> Συσσωρευμένη
// (η τελευταία κατηγορία μπορεί να πάει αρνητική αν δεν φτάνει το υπόλοιπο)
export function deductCascading(balances: HourBalances, hoursNeeded: number): HourBalances {
  let remaining = hoursNeeded;

  const overtimeDeduct = Math.min(balances.hoursOvertime, remaining);
  remaining -= overtimeDeduct;

  const holidaysDeduct = Math.min(balances.hoursHolidays, remaining);
  remaining -= holidaysDeduct;

  const annualDeduct = Math.min(balances.hoursAnnual, remaining);
  remaining -= annualDeduct;

  return {
    hoursOvertime: balances.hoursOvertime - overtimeDeduct,
    hoursHolidays: balances.hoursHolidays - holidaysDeduct,
    hoursAnnual: balances.hoursAnnual - annualDeduct,
    hoursAccumulated: balances.hoursAccumulated - remaining,
  };
}

export function totalHourBalance(b: HourBalances): number {
  return b.hoursOvertime + b.hoursHolidays + b.hoursAnnual + b.hoursAccumulated;
}

export const QUALIFICATIONS = ["ΟΔ/ΑΣ", "ΟΔ", "ΑΣ", "οδ/ΑΣ", "οδ"];
export const RANKS = ["Πυρ/μος", "Α/Π", "Δ/Πυρ.", "Ε/Π"];
export const EMPLOYEE_TYPES = [
  { value: "PERMANENT", label: "Μόνιμος" },
  { value: "TWP", label: "Τ.Ω.Π." },
];

// Μέγιστο απόθεμα Συσσωρευμένης άδειας (μεταφορά τέλους έτους)
export const MAX_TWP_ACCUMULATED_HOURS = 334.4;
export const MAX_PERMANENT_ACCUMULATED_DAYS = 100;
