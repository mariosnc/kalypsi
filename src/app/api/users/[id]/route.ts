import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupsForDepartment } from "@/lib/shifts";
import { QUALIFICATIONS, RANKS } from "@/lib/balances";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const body = await req.json();
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  const data: any = {};

  if (body.name !== undefined) data.name = body.name;

  if (body.department !== undefined) data.department = body.department;

  const finalDept = body.department ?? existing.department;
  if (body.shiftGroup !== undefined) {
    if (finalDept) {
      const validGroups = groupsForDepartment(finalDept);
      if (!validGroups.includes(body.shiftGroup)) {
        return NextResponse.json({ error: "Άγνωστη ομάδα για αυτό το τμήμα." }, { status: 400 });
      }
    }
    data.shiftGroup = body.shiftGroup;
  }

  if (body.shiftType !== undefined) {
    if (body.shiftType !== "DAY" && body.shiftType !== "NIGHT" && body.shiftType !== null) {
      return NextResponse.json({ error: "Μη έγκυρη βάρδια." }, { status: 400 });
    }
    data.shiftType = finalDept === "Μονιάτης" ? body.shiftType : null;
  }

  if (body.phone !== undefined) {
    const phoneStr = String(body.phone).trim();
    if (!/^\d{8}$/.test(phoneStr)) {
      return NextResponse.json({ error: "Ο αριθμός τηλεφώνου πρέπει να έχει ακριβώς 8 ψηφία." }, { status: 400 });
    }
    data.phone = phoneStr;
  }

  if (body.rank !== undefined) {
    if (!RANKS.includes(body.rank)) {
      return NextResponse.json({ error: "Επίλεξε έγκυρο βαθμό." }, { status: 400 });
    }
    data.rank = body.rank;
  }

  if (body.employeeType !== undefined) {
    data.employeeType = body.employeeType === "PERMANENT" ? "PERMANENT" : "TWP";
  }

  if (body.qualifications !== undefined) {
    data.qualifications = Array.isArray(body.qualifications)
      ? body.qualifications.filter((q: string) => QUALIFICATIONS.includes(q))
      : [];
  }

  if (body.role !== undefined) {
    data.role = body.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data });

  return NextResponse.json({
    id: updated.id, name: updated.name, department: updated.department, shiftGroup: updated.shiftGroup,
    phone: updated.phone, rank: updated.rank, employeeType: updated.employeeType, qualifications: updated.qualifications,
    role: updated.role,
  });
}
