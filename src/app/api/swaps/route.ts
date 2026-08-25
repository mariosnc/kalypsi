import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const statusFilter = req.nextUrl.searchParams.get("status") || undefined;

  const where: any = {};
  if (session.role !== "ADMIN") {
    where.OR = [{ requesterId: session.sub }, { colleagueId: session.sub }];
  }
  if (statusFilter) where.status = statusFilter;

  const swaps = await prisma.shiftSwap.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, department: true } },
      colleague: { select: { id: true, name: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(swaps);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const { colleagueId, date } = await req.json();
  if (!colleagueId || !date) {
    return NextResponse.json({ error: "Λείπει συνάδελφος ή ημερομηνία." }, { status: 400 });
  }
  if (colleagueId === session.sub) {
    return NextResponse.json({ error: "Δεν μπορείς να κάνεις αίτημα με τον εαυτό σου." }, { status: 400 });
  }

  const colleague = await prisma.user.findUnique({ where: { id: colleagueId } });
  if (!colleague) return NextResponse.json({ error: "Δεν βρέθηκε ο συνάδελφος." }, { status: 404 });

  const swap = await prisma.shiftSwap.create({
    data: {
      requesterId: session.sub,
      colleagueId,
      date: new Date(date + "T00:00:00Z"),
      status: "PENDING",
    },
  });

  return NextResponse.json(swap, { status: 201 });
}
