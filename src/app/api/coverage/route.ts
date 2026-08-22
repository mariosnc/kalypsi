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
  const end = new Date(Date.UTC(year, mo, 0)); // last day of month

  const [totalEmployees, approved] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);

  const days: { date: string; available: number }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const onLeave = new Set(
      approved.filter((r) => r.startDate <= cur && r.endDate >= cur).map((r) => r.userId)
    ).size;
    days.push({ date: cur.toISOString().slice(0, 10), available: totalEmployees - onLeave });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return NextResponse.json({ totalEmployees, days });
}
