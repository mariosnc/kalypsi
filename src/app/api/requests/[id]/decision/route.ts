import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductCascading } from "@/lib/balances";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να αποφασίσει." }, { status: 403 });
  }

  const { decision, reason } = await req.json();
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json({ error: "Μη έγκυρη απόφαση." }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Δεν βρέθηκε η αίτηση." }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Η αίτηση έχει ήδη κριθεί." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: decision,
        decidedAt: new Date(),
        rejectionReason: decision === "REJECTED" ? (reason || null) : null,
      },
    });

    if (decision === "APPROVED") {
      const user = await tx.user.findUnique({ where: { id: existing.userId } });
      if (user) {
        if (user.employeeType === "PERMANENT" && existing.days) {
          if (existing.leaveType === "DAYOFF") {
            await tx.user.update({ where: { id: user.id }, data: { daysDayOff: { decrement: existing.days } } });
          } else {
            await tx.user.update({ where: { id: user.id }, data: { daysLeave: { decrement: existing.days } } });
          }
        } else {
          const newBalances = deductCascading(
            {
              hoursOvertime: user.hoursOvertime,
              hoursHolidays: user.hoursHolidays,
              hoursAnnual: user.hoursAnnual,
              hoursAccumulated: user.hoursAccumulated,
            },
            existing.hours
          );
          await tx.user.update({ where: { id: user.id }, data: newBalances });
        }
      }
    }

    return updated;
  });

  return NextResponse.json(result);
}
