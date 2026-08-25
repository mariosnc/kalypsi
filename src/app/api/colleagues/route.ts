import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!me) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  const colleagues = await prisma.user.findMany({
    where: { role: "EMPLOYEE", department: me.department, id: { not: me.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(colleagues);
}
