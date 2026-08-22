import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  let rule = await prisma.staffingRule.findFirst();
  if (!rule) rule = await prisma.staffingRule.create({ data: { minStaff: 1 } });

  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const { minStaff } = await req.json();
  if (typeof minStaff !== "number" || minStaff < 0) {
    return NextResponse.json({ error: "Μη έγκυρη τιμή." }, { status: 400 });
  }

  let rule = await prisma.staffingRule.findFirst();
  if (!rule) {
    rule = await prisma.staffingRule.create({ data: { minStaff } });
  } else {
    rule = await prisma.staffingRule.update({ where: { id: rule.id }, data: { minStaff } });
  }

  return NextResponse.json(rule);
}
