import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const absences = await prisma.staffAbsence.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json(absences);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να προσθέσει απουσία." }, { status: 403 });
  }

  const { department, type, count, startDate, endDate } = await req.json();
  if (!department || (type !== "DOCTOR" && type !== "TRAINING") || !startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα." }, { status: 400 });
  }
  const n = Number(count);
  if (!n || n < 1) {
    return NextResponse.json({ error: "Ο αριθμός ατόμων πρέπει να είναι τουλάχιστον 1." }, { status: 400 });
  }

  const absence = await prisma.staffAbsence.create({
    data: {
      department,
      type,
      count: n,
      startDate: new Date(startDate + "T00:00:00Z"),
      endDate: new Date(endDate + "T00:00:00Z"),
    },
  });

  return NextResponse.json(absence, { status: 201 });
}
