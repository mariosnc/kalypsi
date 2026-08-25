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
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam + "T00:00:00Z") : todayUTC();

  // εξασφαλίζει ότι κάθε τμήμα έχει σημείο αναφοράς· αν όχι, ξεκινά σήμερα με την προεπιλεγμένη ομάδα
  for (const dep of DEPARTMENTS) {
    const groups = groupsForDepartment(dep);
    const startGroup = defaultStartingGroup(dep);
    await prisma.shiftCycle.upsert({
      where: { department: dep },
      update: {},
      create: { department: dep, anchorDate: todayUTC(), anchorGroupIndex: groups.indexOf(startGroup) },
    });
  }

  const cycles = await prisma.shiftCycle.findMany({ where: { department: { in: DEPARTMENTS } } });

  const result = cycles.map((c) => {
    const groups = groupsForDepartment(c.department);
    const idx = computeWorkingGroupIndex(c.anchorDate, c.anchorGroupIndex, targetDate, groups.length);
    return {
      department: c.department,
      groups,
      workingGroup: groups[idx],
      anchorDate: c.anchorDate,
      anchorGroupIndex: c.anchorGroupIndex,
    };
  });

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να το αλλάξει." }, { status: 403 });
  }

  const { department, date, group } = await req.json();
  if (!department || !date || !group) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα." }, { status: 400 });
  }
  const groups = groupsForDepartment(department);
  const idx = groups.indexOf(group);
  if (idx === -1) {
    return NextResponse.json({ error: "Άγνωστη ομάδα για αυτό το τμήμα." }, { status: 400 });
  }

  const cycle = await prisma.shiftCycle.upsert({
    where: { department },
    update: { anchorDate: new Date(date + "T00:00:00Z"), anchorGroupIndex: idx },
    create: { department, anchorDate: new Date(date + "T00:00:00Z"), anchorGroupIndex: idx },
  });

  return NextResponse.json(cycle);
}
