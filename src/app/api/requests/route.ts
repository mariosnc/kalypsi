import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeaveHours } from "@/lib/date";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;

  const where: any = {};
  if (session.role !== "ADMIN") where.userId = session.sub;
  if (status) where.status = status;

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: { user: { select: { id: true, name: true, department: true, balanceHours: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const { startDate, endDate } = await req.json();
  if (!startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Μη έγκυρο εύρος ημερομηνιών." }, { status: 400 });
  }

  const hours = computeLeaveHours(startDate, endDate);
  if (hours <= 0) {
    return NextResponse.json({ error: "Το εύρος δεν περιέχει εργάσιμες ημέρες." }, { status: 400 });
  }

  const created = await prisma.leaveRequest.create({
    data: {
      userId: session.sub,
      startDate: new Date(startDate + "T00:00:00Z"),
      endDate: new Date(endDate + "T00:00:00Z"),
      hours,
      status: "PENDING",
    },
  });

  return NextResponse.json(created, { status: 201 });
}
