import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να κάνει προσαρμογές." }, { status: 403 });
  }

  const { hours, reason } = await req.json();
  if (typeof hours !== "number" || hours === 0) {
    return NextResponse.json({ error: "Δώσε μη μηδενικό αριθμό ωρών." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.balanceAdjustment.create({
      data: { userId: params.id, hours, reason: reason || null },
    });
    return tx.user.update({
      where: { id: params.id },
      data: { balanceHours: { increment: hours } },
    });
  });

  return NextResponse.json({ id: result.id, balanceHours: result.balanceHours });
}
