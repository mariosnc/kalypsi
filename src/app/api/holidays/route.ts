import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json(holidays);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να προσθέσει αργία." }, { status: 403 });
  }

  const { date, name } = await req.json();
  if (!date) return NextResponse.json({ error: "Λείπει ημερομηνία." }, { status: 400 });

  const holiday = await prisma.holiday.upsert({
    where: { date: new Date(date + "T00:00:00Z") },
    update: { name: name || null },
    create: { date: new Date(date + "T00:00:00Z"), name: name || null },
  });

  return NextResponse.json(holiday, { status: 201 });
}
