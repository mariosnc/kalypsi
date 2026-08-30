import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeaveHours } from "@/lib/date";
import { groupsForDepartment, defaultStartingGroup, dayNightGroups, visibleTeamPairs } from "@/lib/shifts";
import { deductCascading } from "@/lib/balances";

function inclusiveDayCount(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const where: any = {};
  if (session.role !== "ADMIN" || mine) {
    where.userId = session.sub;
  } else {
    // Κανονικοί διαχειριστές (όχι τελικής έγκρισης) βλέπουν μόνο τις αιτήσεις της δικής τους ομάδας —
    // και, αν είναι στον Αγρό ή στο Πελένδρι, και το αντίστοιχο ζευγάρι με το ίδιο γράμμα ομάδας.
    const admin = await prisma.user.findUnique({ where: { id: session.sub } });
    if (admin && !admin.finalApprover && admin.staffMember && admin.department && admin.shiftGroup && admin.department !== "Μονιάτης") {
      const pairs = visibleTeamPairs(admin.department, admin.shiftGroup);
      where.OR = pairs.map((p) => ({ user: { department: p.department, shiftGroup: p.shiftGroup } }));
    }
  }
  if (status) where.status = status;

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, department: true, employeeType: true, hoursOvertime: true, hoursHolidays: true, hoursAnnual: true, hoursAccumulated: true, daysLeave: true, daysDayOff: true, daysAccumulated: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// Υπολογίζει αυτόματα αν ο υπάλληλος του Μονιάτη κάνει βάρδια Ημέρας ή Νύχτας στη δεδομένη ημερομηνία,
// με βάση την ομάδα του και τον κύκλο βαρδιών (χωρίς να χρειάζεται να το επιλέξει ο ίδιος).
async function computeMoniatisShiftType(userShiftGroup: string | null, startDate: string): Promise<"DAY" | "NIGHT" | null> {
  if (!userShiftGroup) return null;
  const groups = groupsForDepartment("Μονιάτης");
  const cycle = await prisma.shiftCycle.findUnique({ where: { department: "Μονιάτης" } });
  const anchorDate = cycle?.anchorDate || todayUTC();
  const anchorIdx = cycle?.anchorGroupIndex ?? groups.indexOf(defaultStartingGroup("Μονιάτης"));
  const day = new Date(startDate + "T00:00:00Z");
  const { dayGroup, nightGroup } = dayNightGroups(anchorDate, anchorIdx, day, groups);
  if (userShiftGroup === dayGroup) return "DAY";
  if (userShiftGroup === nightGroup) return "NIGHT";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const { startDate, endDate, leaveType } = await req.json();
  if (!startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Μη έγκυρο εύρος ημερομηνιών." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "Δεν βρέθηκε χρήστης." }, { status: 404 });

  // Οι διαχειριστές (εφόσον είναι μέλη προσωπικού) δεν χρειάζονται έγκριση — η αίτησή τους
  // εγκρίνεται αυτόματα κατά την υποβολή και ενημερώνει κατευθείαν την ημερήσια κατάσταση.
  const autoApprove = user.role === "ADMIN";

  let finalShiftType: "DAY" | "NIGHT" | null = null;
  if (user.department === "Μονιάτης") {
    finalShiftType = await computeMoniatisShiftType(user.shiftGroup, startDate);
  }

  if (user.employeeType === "PERMANENT") {
    if (leaveType !== "LEAVE" && leaveType !== "DAYOFF") {
      return NextResponse.json({ error: "Επίλεξε τύπο: Άδεια ή Ημεραργία." }, { status: 400 });
    }
    const days = inclusiveDayCount(startDate, endDate);

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.leaveRequest.create({
        data: {
          userId: session.sub,
          startDate: new Date(startDate + "T00:00:00Z"),
          endDate: new Date(endDate + "T00:00:00Z"),
          hours: 0,
          days,
          leaveType,
          shiftType: finalShiftType,
          status: autoApprove ? "APPROVED" : "PENDING",
          decidedAt: autoApprove ? new Date() : null,
        },
      });
      if (autoApprove) {
        if (leaveType === "DAYOFF") {
          await tx.user.update({ where: { id: user.id }, data: { daysDayOff: { decrement: days } } });
        } else {
          await tx.user.update({ where: { id: user.id }, data: { daysLeave: { decrement: days } } });
        }
      }
      return req;
    });

    return NextResponse.json(created, { status: 201 });
  }

  const hours = computeLeaveHours(startDate, endDate);
  if (hours <= 0) {
    return NextResponse.json({ error: "Μη έγκυρο εύρος." }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.leaveRequest.create({
      data: {
        userId: session.sub,
        startDate: new Date(startDate + "T00:00:00Z"),
        endDate: new Date(endDate + "T00:00:00Z"),
        hours,
        shiftType: finalShiftType,
        status: autoApprove ? "APPROVED" : "PENDING",
        decidedAt: autoApprove ? new Date() : null,
      },
    });
    if (autoApprove) {
      const newBalances = deductCascading(
        {
          hoursOvertime: user.hoursOvertime,
          hoursHolidays: user.hoursHolidays,
          hoursAnnual: user.hoursAnnual,
          hoursAccumulated: user.hoursAccumulated,
        },
        hours
      );
      await tx.user.update({ where: { id: user.id }, data: newBalances });
    }
    return req;
  });

  return NextResponse.json(created, { status: 201 });
}
