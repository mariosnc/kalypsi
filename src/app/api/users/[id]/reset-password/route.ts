import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να επαναφέρει κωδικό." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });
  if (!user.phone) {
    return NextResponse.json({ error: "Δεν υπάρχει καταχωρημένο τηλέφωνο για αυτόν τον χρήστη." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(user.phone, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true, newPassword: user.phone });
}
