import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeaveHours } from "@/lib/date";

function inclusiveDayCount(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;

  const where: any = {};
  if (session.role !== "ADMIN") where.userId = session.sub;
  if (status) where.status = status;

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, department: true, employeeType: true, hoursOvertime: true, hoursHolidays: true, hoursAnnual: true, hoursAccumulated: true, daysLeave: true, daysDayOff: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const { startDate, endDate, leaveType, shiftType } = await req.json();
  if (!startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Μη έγκυρο εύρος ημερομηνιών." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  let finalShiftType: "DAY" | "NIGHT" | null = null;
  if (user.department === "Μονιάτης") {
    if (shiftType !== "DAY" && shiftType !== "NIGHT") {
      return NextResponse.json({ error: "Επίλεξε βάρδια: Ημέρα ή Νύχτα." }, { status: 400 });
    }
    finalShiftType = shiftType;
  }

  if (user.employeeType === "PERMANENT") {
    if (leaveType !== "LEAVE" && leaveType !== "DAYOFF") {
      return NextResponse.json({ error: "Επίλεξε τύπο: Άδεια ή Ημεραργία." }, { status: 400 });
    }
    const days = inclusiveDayCount(startDate, endDate);
    const created = await prisma.leaveRequest.create({
      data: {
        userId: session.sub,
        startDate: new Date(startDate + "T00:00:00Z"),
        endDate: new Date(endDate + "T00:00:00Z"),
        hours: 0,
        days,
        leaveType,
        shiftType: finalShiftType,
        status: "PENDING",
      },
    });
    return NextResponse.json(created, { status: 201 });
  }

  const hours = computeLeaveHours(startDate, endDate);
  if (hours <= 0) {
    return NextResponse.json({ error: "Μη έγκυρο εύρος." }, { status: 400 });
  }

  const created = await prisma.leaveRequest.create({
    data: {
      userId: session.sub,
      startDate: new Date(startDate + "T00:00:00Z"),
      endDate: new Date(endDate + "T00:00:00Z"),
      hours,
      shiftType: finalShiftType,
      status: "PENDING",
    },
  });

  return NextResponse.json(created, { status: 201 });
}
