import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να αποφασίσει." }, { status: 403 });
  }

  const { decision } = await req.json();
  if (decision !== "APPROVED" && decision !== "ADMIN_REJECTED") {
    return NextResponse.json({ error: "Μη έγκυρη απόφαση." }, { status: 400 });
  }

  const swap = await prisma.shiftSwap.findUnique({ where: { id: params.id } });
  if (!swap) return NextResponse.json({ error: "Δεν βρέθηκε το αίτημα." }, { status: 404 });
  if (swap.status !== "COLLEAGUE_ACCEPTED") {
    return NextResponse.json({ error: "Ο συνάδελφος δεν έχει αποδεχτεί ακόμα το αίτημα." }, { status: 409 });
  }

  const updated = await prisma.shiftSwap.update({
    where: { id: params.id },
    data: { status: decision, decidedAt: new Date() },
  });

  return NextResponse.json(updated);
}
