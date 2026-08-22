import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να αποφασίσει." }, { status: 403 });
  }

  const { decision } = await req.json();
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
      data: { status: decision, decidedAt: new Date() },
    });

    if (decision === "APPROVED") {
      await tx.user.update({
        where: { id: existing.userId },
        data: { balanceHours: { decrement: existing.hours } },
      });
    }

    return updated;
  });

  return NextResponse.json(result);
}
