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
    where: { staffMember: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, department: true, shiftGroup: true, role: true,
      phone: true, qualifications: true, employeeType: true, rank: true,
      staffMember: true, finalApprover: true,
      hoursOvertime: true, hoursHolidays: true, hoursAnnual: true, hoursAccumulated: true,
      daysLeave: true, daysDayOff: true, daysAccumulated: true,
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
    daysLeave, daysDayOff, daysAccumulated, staffMember, finalApprover,
  } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Λείπει όνομα, όνομα χρήστη ή κωδικός." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες." }, { status: 400 });
  }
  const username = String(email).trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return NextResponse.json({ error: "Το όνομα χρήστη μπορεί να έχει μόνο λατινικά γράμματα, αριθμούς, τελείες, παύλες." }, { status: 400 });
  }
  const finalRole = role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  // Μόνο διαχειριστές μπορούν να μην είναι μέλη προσωπικού· υπάλληλοι είναι πάντα μέλη προσωπικού
  const isStaff = finalRole === "ADMIN" ? staffMember !== false : true;
  const isFinalApprover = finalRole === "ADMIN" && !!finalApprover;

  const existing = await prisma.user.findUnique({ where: { email: username } });
  if (existing) {
    return NextResponse.json({ error: "Υπάρχει ήδη χρήστης με αυτό το όνομα χρήστη." }, { status: 409 });
  }

  // Στοιχεία προσωπικού (τμήμα, ομάδα, τηλέφωνο, βαθμός) απαιτούνται μόνο για μέλη προσωπικού
  if (isStaff) {
    if (!department) {
      return NextResponse.json({ error: "Λείπει τμήμα." }, { status: 400 });
    }
    const validGroups = groupsForDepartment(department);
    if (!validGroups.includes(shiftGroup)) {
      return NextResponse.json({ error: "Επίλεξε έγκυρη ομάδα για αυτό το τμήμα." }, { status: 400 });
    }
    const phoneStr = String(phone || "").trim();
    if (!/^\d{8}$/.test(phoneStr)) {
      return NextResponse.json({ error: "Ο αριθμός τηλεφώνου πρέπει να έχει ακριβώς 8 ψηφία." }, { status: 400 });
    }
    if (!RANKS.includes(rank)) {
      return NextResponse.json({ error: "Επίλεξε έγκυρο βαθμό." }, { status: 400 });
    }
  }

  const finalEmployeeType = employeeType === "PERMANENT" ? "PERMANENT" : "TWP";
  const quals: string[] = Array.isArray(qualifications) ? qualifications.filter((q: string) => QUALIFICATIONS.includes(q)) : [];
  const phoneStr = String(phone || "").trim();

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: username,
      passwordHash,
      department: isStaff ? department : null,
      shiftGroup: isStaff ? shiftGroup : null,
      phone: isStaff ? phoneStr : null,
      rank: isStaff ? rank : null,
      qualifications: isStaff ? quals : [],
      employeeType: finalEmployeeType,
      staffMember: isStaff,
      finalApprover: isFinalApprover,
      hoursOvertime: Math.round(Number(hoursOvertime || 0)),
      hoursHolidays: Math.round(Number(hoursHolidays || 0)),
      hoursAnnual: Math.round(Number(hoursAnnual || 0)),
      hoursAccumulated: Math.round(Number(hoursAccumulated || 0)),
      daysLeave: Number(daysLeave || 0),
      daysDayOff: Number(daysDayOff || 0),
      daysAccumulated: Number(daysAccumulated || 0),
      role: finalRole,
    },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
