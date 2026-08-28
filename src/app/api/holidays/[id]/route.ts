import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να διαγράψει αργία." }, { status: 403 });
  }
  await prisma.holiday.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
