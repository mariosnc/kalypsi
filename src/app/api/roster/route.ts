import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupsForDepartment, defaultStartingGroup, computeWorkingGroupIndex } from "@/lib/shifts";
import { RANKS } from "@/lib/balances";

const DEPARTMENTS = ["Μονιάτης", "Πελένδρι", "Αγρός", "Εφταγώνια", "Πάχνα", "Κυβίδες"];

function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Λείπει ημερομηνία." }, { status: 400 });

  const day = new Date(date + "T00:00:00Z");

  const [users, approvedOnDay, cycles, approvedSwaps] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, department: true, shiftGroup: true, phone: true, qualifications: true, rank: true, role: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: day }, endDate: { gte: day } },
      select: { userId: true },
    }),
    prisma.shiftCycle.findMany({ where: { department: { in: DEPARTMENTS } } }),
    prisma.shiftSwap.findMany({ where: { status: "APPROVED", date: day } }),
  ]);

  const onLeaveIds = new Set(approvedOnDay.map((r) => r.userId));
  const swapOffIds = new Set(approvedSwaps.map((s) => s.requesterId));
  const swapCoverIds = new Set(approvedSwaps.map((s) => s.colleagueId));

  const workingGroupByDept: Record<string, string> = {};
  for (const dep of DEPARTMENTS) {
    const groups = groupsForDepartment(dep);
    const cycle = cycles.find((c) => c.department === dep);
    const anchorDate = cycle?.anchorDate || todayUTC();
    const anchorIdx = cycle?.anchorGroupIndex ?? groups.indexOf(defaultStartingGroup(dep));
    const idx = computeWorkingGroupIndex(anchorDate, anchorIdx, day, groups.length);
    workingGroupByDept[dep] = groups[idx];
  }

  const rankOrder = (r: string | null) => {
    const idx = RANKS.indexOf(r || "");
    return idx === -1 ? RANKS.length : idx;
  };

  const roster = users
    .filter((u) => u.role === "EMPLOYEE")
    .map((u) => {
      const onLeave = onLeaveIds.has(u.id);
      const dept = u.department || "";
      const workingGroup = workingGroupByDept[dept];
      const onShift = !workingGroup || u.shiftGroup === workingGroup;

      // "OFF" = εκτός βάρδιας λόγω κύκλου εργασίας (σαν υπερωρία/ρεπό βάρδιας)
      // "Άδεια" = οποιαδήποτε άλλη περίπτωση απουσίας (κανονική άδεια, ημεραργία, κάλυψη από συνάδελφο)
      let status: "working" | "off" | "on_leave" = "working";
      if (swapCoverIds.has(u.id)) status = "working";
      else if (onLeave || swapOffIds.has(u.id)) status = "on_leave";
      else if (!onShift) status = "off";

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        rank: u.rank,
        shiftGroup: u.shiftGroup,
        phone: u.phone,
        qualifications: u.qualifications,
        status,
      };
    })
    .sort((a, b) => {
      const depCompare = (a.department || "").localeCompare(b.department || "", "el");
      if (depCompare !== 0) return depCompare;
      return rankOrder(a.rank) - rankOrder(b.rank);
    });

  return NextResponse.json({
    date,
    working: roster.filter((r) => r.status === "working").length,
    total: roster.length,
    workingGroupByDept,
    roster,
  });
}
