import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupsForDepartment } from "@/lib/shifts";
import { QUALIFICATIONS, RANKS } from "@/lib/balances";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, department: true, shiftGroup: true, role: true,
      phone: true, qualifications: true, employeeType: true, rank: true,
      hoursOvertime: true, hoursHolidays: true, hoursAnnual: true, hoursAccumulated: true,
      daysLeave: true, daysDayOff: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να προσθέσει χρήστη." }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, email, password, department, role, shiftGroup,
    phone, qualifications, employeeType, rank,
    hoursOvertime, hoursHolidays, hoursAnnual, hoursAccumulated,
    daysLeave, daysDayOff,
  } = body;

  if (!name || !email || !password || !department) {
    return NextResponse.json({ error: "Λείπει όνομα, όνομα χρήστη, κωδικός ή τμήμα." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες." }, { status: 400 });
  }
  const username = String(email).trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return NextResponse.json({ error: "Το όνομα χρήστη μπορεί να έχει μόνο λατινικά γράμματα, αριθμούς, τελείες, παύλες." }, { status: 400 });
  }
  const finalRole = role === "ADMIN" ? "ADMIN" : "EMPLOYEE";

  const validGroups = groupsForDepartment(department);
  if (!validGroups.includes(shiftGroup)) {
    return NextResponse.json({ error: "Επίλεξε έγκυρη ομάδα για αυτό το τμήμα." }, { status: 400 });
  }

  if (department === "Μονιάτης" && !shiftGroup) {
    return NextResponse.json({ error: "Επίλεξε ομάδα βάρδιας για το Μονιάτης." }, { status: 400 });
  }

  const phoneStr = String(phone || "").trim();
  if (!/^\d{8}$/.test(phoneStr)) {
    return NextResponse.json({ error: "Ο αριθμός τηλεφώνου πρέπει να έχει ακριβώς 8 ψηφία." }, { status: 400 });
  }

  if (!RANKS.includes(rank)) {
    return NextResponse.json({ error: "Επίλεξε έγκυρο βαθμό." }, { status: 400 });
  }

  const finalEmployeeType = employeeType === "PERMANENT" ? "PERMANENT" : "TWP";
  const quals: string[] = Array.isArray(qualifications) ? qualifications.filter((q: string) => QUALIFICATIONS.includes(q)) : [];

  const existing = await prisma.user.findUnique({ where: { email: username } });
  if (existing) {
    return NextResponse.json({ error: "Υπάρχει ήδη χρήστης με αυτό το όνομα χρήστη." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: username,
      passwordHash,
      department,
      shiftGroup,
      phone: phoneStr,
      rank,
      qualifications: quals,
      employeeType: finalEmployeeType,
      hoursOvertime: Math.round(Number(hoursOvertime || 0)),
      hoursHolidays: Math.round(Number(hoursHolidays || 0)),
      hoursAnnual: Math.round(Number(hoursAnnual || 0)),
      hoursAccumulated: Math.round(Number(hoursAccumulated || 0)),
      daysLeave: Math.round(Number(daysLeave || 0)),
      daysDayOff: Math.round(Number(daysDayOff || 0)),
      role: finalRole,
    },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
