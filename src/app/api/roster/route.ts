import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Λείπει ημερομηνία." }, { status: 400 });

  const day = new Date(date + "T00:00:00Z");

  const [users, approvedOnDay] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, department: true, role: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: day }, endDate: { gte: day } },
      select: { userId: true },
    }),
  ]);

  const onLeaveIds = new Set(approvedOnDay.map((r) => r.userId));

  const roster = users
    .filter((u) => u.role === "EMPLOYEE")
    .map((u) => ({ ...u, onLeave: onLeaveIds.has(u.id) }));

  return NextResponse.json({
    date,
    working: roster.filter((r) => !r.onLeave).length,
    total: roster.length,
    roster,
  });
}
