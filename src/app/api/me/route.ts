import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staffMember: user.staffMember,
    finalApprover: user.finalApprover,
    department: user.department,
    shiftGroup: user.shiftGroup,
    phone: user.phone,
    qualifications: user.qualifications,
    employeeType: user.employeeType,
    rank: user.rank,
    hoursOvertime: user.hoursOvertime,
    hoursHolidays: user.hoursHolidays,
    hoursAnnual: user.hoursAnnual,
    hoursAccumulated: user.hoursAccumulated,
    daysLeave: user.daysLeave,
    daysDayOff: user.daysDayOff,
    daysAccumulated: user.daysAccumulated,
  });
}
