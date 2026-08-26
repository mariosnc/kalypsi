import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Για το Μονιάτης, η κάλυψη υπολογίζεται ξεχωριστά ανά βάρδια (Ημέρα/Νύχτα)
function effectiveKey(department: string, shiftType?: string | null) {
  if (department === "Μονιάτης") return `Μονιάτης (${shiftType === "NIGHT" ? "Νύχτα" : "Ημέρα"})`;
  return department;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  if (!month) return NextResponse.json({ error: "Λείπει μήνας." }, { status: 400 });

  const [year, mo] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mo - 1, 1));
  const end = new Date(Date.UTC(year, mo, 0));

  const [rules, approved, absences] = await Promise.all([
    prisma.staffingRule.findMany(),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
      select: { userId: true, startDate: true, endDate: true, shiftType: true, user: { select: { department: true } } },
    }),
    prisma.staffAbsence.findMany({
      where: { startDate: { lte: end }, endDate: { gte: start } },
    }),
  ]);

  const totalForceByKey: Record<string, number> = {};
  for (const r of rules) totalForceByKey[effectiveKey(r.department, r.shiftType)] = r.totalForce;
  const keys = Object.keys(totalForceByKey).sort();

  const days: { date: string; byDept: Record<string, number> }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const onLeaveByKey: Record<string, Set<string>> = {};
    for (const r of approved) {
      if (r.startDate <= cur && r.endDate >= cur) {
        const dept = r.user.department || "Χωρίς τμήμα";
        const k = effectiveKey(dept, r.shiftType);
        if (!onLeaveByKey[k]) onLeaveByKey[k] = new Set();
        onLeaveByKey[k].add(r.userId);
      }
    }
    const absentByKey: Record<string, number> = {};
    for (const a of absences) {
      if (a.startDate <= cur && a.endDate >= cur) {
        if (a.department === "Μονιάτης") {
          // δεν ξέρουμε ποια βάρδια αφορά η απουσία ιατρού/εκπαίδευσης, αφαιρείται από κάθε βάρδια
          const dayKey = effectiveKey("Μονιάτης", "DAY");
          const nightKey = effectiveKey("Μονιάτης", "NIGHT");
          absentByKey[dayKey] = (absentByKey[dayKey] || 0) + a.count;
          absentByKey[nightKey] = (absentByKey[nightKey] || 0) + a.count;
        } else {
          absentByKey[a.department] = (absentByKey[a.department] || 0) + a.count;
        }
      }
    }

    const byDept: Record<string, number> = {};
    for (const k of keys) {
      byDept[k] = (totalForceByKey[k] || 0) - (absentByKey[k] || 0) - (onLeaveByKey[k]?.size || 0);
    }
    days.push({ date: cur.toISOString().slice(0, 10), byDept });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return NextResponse.json({ departments: keys, days });
}
