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
    if (dep === "Μονιάτης") {
      for (const st of ["DAY", "NIGHT"]) {
        await prisma.staffingRule.upsert({
          where: { department_shiftType: { department: dep, shiftType: st } },
          update: {},
          create: { department: dep, shiftType: st, totalForce: 0 },
        });
      }
    } else {
      await prisma.staffingRule.upsert({
        where: { department_shiftType: { department: dep, shiftType: "" } },
        update: {},
        create: { department: dep, shiftType: "", totalForce: 0 },
      });
    }
  }

  const rules = await prisma.staffingRule.findMany({
    where: { department: { in: departments } },
    orderBy: [{ department: "asc" }, { shiftType: "asc" }],
  });

  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const { department, totalForce, shiftType } = await req.json();
  if (!department || typeof totalForce !== "number" || totalForce < 0) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα." }, { status: 400 });
  }
  const st = department === "Μονιάτης" ? (shiftType === "NIGHT" ? "NIGHT" : "DAY") : "";

  const rule = await prisma.staffingRule.upsert({
    where: { department_shiftType: { department, shiftType: st } },
    update: { totalForce },
    create: { department, shiftType: st, totalForce },
  });

  return NextResponse.json(rule);
}
