import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupsForDepartment } from "@/lib/shifts";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const { shiftGroup, department } = await req.json();

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  const finalDept = department || existing.department;
  if (shiftGroup !== undefined && finalDept) {
    const validGroups = groupsForDepartment(finalDept);
    if (!validGroups.includes(shiftGroup)) {
      return NextResponse.json({ error: "Άγνωστη ομάδα για αυτό το τμήμα." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(department ? { department } : {}),
      ...(shiftGroup !== undefined ? { shiftGroup } : {}),
    },
  });

  return NextResponse.json({ id: updated.id, department: updated.department, shiftGroup: updated.shiftGroup });
}
