import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TWP_ACCUMULATED_HOURS, MAX_PERMANENT_ACCUMULATED_DAYS } from "@/lib/balances";

// Μεταφορά αδειών τέλους έτους:
// - Μόνιμοι: η αχρησιμοποίητη Άδεια πάει στη Συσσωρευμένη (μέγιστο απόθεμα 100 ημέρες). Η Ημεραργία (R/D) δεν μεταφέρεται.
// - Τ.Ω.Π.: το αχρησιμοποίητο Έτους πάει στη Συσσωρευμένη (μέγιστο απόθεμα 334.40 ώρες). Οι Υπερωρίες δεν μεταφέρονται.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το εκτελέσει." }, { status: 403 });
  }
  const admin = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!admin?.finalApprover) {
    return NextResponse.json({ error: "Μόνο διαχειριστής τελικής έγκρισης μπορεί να εκτελέσει τη μεταφορά." }, { status: 403 });
  }

  const users = await prisma.user.findMany({ where: { staffMember: true } });

  let permanentCount = 0;
  let twpCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const u of users) {
      if (u.employeeType === "PERMANENT") {
        const newAccumulated = Math.min(u.daysAccumulated + u.daysLeave, MAX_PERMANENT_ACCUMULATED_DAYS);
        await tx.user.update({
          where: { id: u.id },
          data: { daysAccumulated: newAccumulated, daysLeave: 0 },
        });
        permanentCount++;
      } else {
        const newAccumulated = Math.min(u.hoursAccumulated + u.hoursAnnual, MAX_TWP_ACCUMULATED_HOURS);
        await tx.user.update({
          where: { id: u.id },
          data: { hoursAccumulated: newAccumulated, hoursAnnual: 0 },
        });
        twpCount++;
      }
    }
  });

  return NextResponse.json({ ok: true, permanentCount, twpCount, date: new Date().toISOString() });
}
