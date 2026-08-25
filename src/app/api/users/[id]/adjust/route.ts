import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FIELD_BY_CATEGORY: Record<string, "hoursOvertime" | "hoursHolidays" | "hoursAnnual" | "hoursAccumulated" | "daysLeave" | "daysDayOff"> = {
  OVERTIME: "hoursOvertime",
  HOLIDAYS: "hoursHolidays",
  ANNUAL: "hoursAnnual",
  ACCUMULATED: "hoursAccumulated",
  DAYS_LEAVE: "daysLeave",
  DAYS_DAYOFF: "daysDayOff",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να κάνει προσαρμογές." }, { status: 403 });
  }

  const { hours, reason, category } = await req.json();
  if (typeof hours !== "number" || hours === 0) {
    return NextResponse.json({ error: "Δώσε μη μηδενικό αριθμό." }, { status: 400 });
  }
  const field = FIELD_BY_CATEGORY[category];
  if (!field) {
    return NextResponse.json({ error: "Μη έγκυρη κατηγορία." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.balanceAdjustment.create({
      data: { userId: params.id, hours, category, reason: reason || null },
    });
    return tx.user.update({
      where: { id: params.id },
      data: { [field]: { increment: hours } },
    });
  });

  return NextResponse.json({
    id: result.id,
    hoursOvertime: result.hoursOvertime,
    hoursHolidays: result.hoursHolidays,
    hoursAnnual: result.hoursAnnual,
    hoursAccumulated: result.hoursAccumulated,
    daysLeave: result.daysLeave,
    daysDayOff: result.daysDayOff,
  });
}
