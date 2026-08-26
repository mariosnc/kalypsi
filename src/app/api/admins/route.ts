import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, staffMember: true, finalApprover: true },
  });

  return NextResponse.json(admins);
}
