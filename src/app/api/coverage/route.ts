import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      select: { userId: true, startDate: true, endDate: true, user: { select: { department: true } } },
    }),
    prisma.staffAbsence.findMany({
      where: { startDate: { lte: end }, endDate: { gte: start } },
    }),
  ]);

  const departments = rules.map((r) => r.department).sort();
  const totalForceByDept: Record<string, number> = {};
  for (const r of rules) totalForceByDept[r.department] = r.totalForce;

  const days: { date: string; byDept: Record<string, number> }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    // εγκεκριμένες άδειες εφαρμογής αυτή τη μέρα, ανά τμήμα
    const onLeaveByDept: Record<string, Set<string>> = {};
    for (const r of approved) {
      if (r.startDate <= cur && r.endDate >= cur) {
        const d = r.user.department || "Χωρίς τμήμα";
        if (!onLeaveByDept[d]) onLeaveByDept[d] = new Set();
        onLeaveByDept[d].add(r.userId);
      }
    }
    // απουσίες ιατρού/εκπαίδευσης αυτή τη μέρα, ανά τμήμα
    const absentByDept: Record<string, number> = {};
    for (const a of absences) {
      if (a.startDate <= cur && a.endDate >= cur) {
        absentByDept[a.department] = (absentByDept[a.department] || 0) + a.count;
      }
    }

    const byDept: Record<string, number> = {};
    for (const d of departments) {
      byDept[d] = (totalForceByDept[d] || 0) - (absentByDept[d] || 0) - (onLeaveByDept[d]?.size || 0);
    }
    days.push({ date: cur.toISOString().slice(0, 10), byDept });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return NextResponse.json({ departments, days });
}
