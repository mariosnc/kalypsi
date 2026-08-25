import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupsForDepartment, defaultStartingGroup, computeWorkingGroupIndex } from "@/lib/shifts";

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

  const [users, approvedOnDay, cycles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, department: true, shiftGroup: true, role: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: day }, endDate: { gte: day } },
      select: { userId: true },
    }),
    prisma.shiftCycle.findMany({ where: { department: { in: DEPARTMENTS } } }),
  ]);

  const onLeaveIds = new Set(approvedOnDay.map((r) => r.userId));

  const workingGroupByDept: Record<string, string> = {};
  for (const dep of DEPARTMENTS) {
    const groups = groupsForDepartment(dep);
    const cycle = cycles.find((c) => c.department === dep);
    const anchorDate = cycle?.anchorDate || todayUTC();
    const anchorIdx = cycle?.anchorGroupIndex ?? groups.indexOf(defaultStartingGroup(dep));
    const idx = computeWorkingGroupIndex(anchorDate, anchorIdx, day, groups.length);
    workingGroupByDept[dep] = groups[idx];
  }

  const roster = users
    .filter((u) => u.role === "EMPLOYEE")
    .map((u) => {
      const onLeave = onLeaveIds.has(u.id);
      const dept = u.department || "";
      const workingGroup = workingGroupByDept[dept];
      const onShift = !workingGroup || u.shiftGroup === workingGroup;
      let status: "leave" | "off_shift" | "working" = "working";
      if (onLeave) status = "leave";
      else if (!onShift) status = "off_shift";
      return { ...u, onLeave, onShift, workingGroup, status };
    });

  return NextResponse.json({
    date,
    working: roster.filter((r) => r.status === "working").length,
    total: roster.length,
    workingGroupByDept,
    roster,
  });
}
