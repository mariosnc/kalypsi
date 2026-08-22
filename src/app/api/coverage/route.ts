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

  const [employees, approved] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      select: { id: true, department: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
      select: { userId: true, startDate: true, endDate: true, user: { select: { department: true } } },
    }),
  ]);

  const departments = Array.from(new Set(employees.map((e) => e.department || "Χωρίς τμήμα"))).sort();
  const totalByDept: Record<string, number> = {};
  for (const e of employees) {
    const d = e.department || "Χωρίς τμήμα";
    totalByDept[d] = (totalByDept[d] || 0) + 1;
  }

  const days: { date: string; byDept: Record<string, number> }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const onLeaveByDept: Record<string, Set<string>> = {};
    for (const r of approved) {
      if (r.startDate <= cur && r.endDate >= cur) {
        const d = r.user.department || "Χωρίς τμήμα";
        if (!onLeaveByDept[d]) onLeaveByDept[d] = new Set();
        onLeaveByDept[d].add(r.userId);
      }
    }
    const byDept: Record<string, number> = {};
    for (const d of departments) {
      byDept[d] = (totalByDept[d] || 0) - (onLeaveByDept[d]?.size || 0);
    }
    days.push({ date: cur.toISOString().slice(0, 10), byDept });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return NextResponse.json({ departments, totalByDept, days });
}
