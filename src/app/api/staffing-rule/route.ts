import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const employees = await prisma.user.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  });
  const departments = employees.map((e) => e.department as string).sort();

  for (const dep of departments) {
    await prisma.staffingRule.upsert({
      where: { department: dep },
      update: {},
      create: { department: dep, totalForce: 0 },
    });
  }

  const rules = await prisma.staffingRule.findMany({
    where: { department: { in: departments } },
    orderBy: { department: "asc" },
  });

  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const { department, totalForce } = await req.json();
  if (!department || typeof totalForce !== "number" || totalForce < 0) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα." }, { status: 400 });
  }

  const rule = await prisma.staffingRule.upsert({
    where: { department },
    update: { totalForce },
    create: { department, totalForce },
  });

  return NextResponse.json(rule);
}
