import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const where: any = {};
  if (date) where.date = new Date(date + "T00:00:00Z");

  const transfers = await prisma.departmentTransfer.findMany({
    where,
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transfers);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να προσθέσει μετακίνηση." }, { status: 403 });
  }

  const { userId, toDepartment, startDate, endDate, reason } = await req.json();
  if (!userId || !toDepartment || !startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Δεν βρέθηκε υπάλληλος." }, { status: 404 });

  const dates: Date[] = [];
  let cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cur <= end) {
    dates.push(new Date(cur));
    cur = new Date(cur.getTime() + 86400000);
  }

  const created = await prisma.$transaction(
    dates.map((d) =>
      prisma.departmentTransfer.create({
        data: { userId, fromDepartment: user.department, toDepartment, date: d, reason: reason || null },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
