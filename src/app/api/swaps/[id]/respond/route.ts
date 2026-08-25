import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Μη εξουσιοδοτημένος." }, { status: 401 });

  const { response } = await req.json();
  if (response !== "ACCEPT" && response !== "DECLINE") {
    return NextResponse.json({ error: "Μη έγκυρη απάντηση." }, { status: 400 });
  }

  const swap = await prisma.shiftSwap.findUnique({ where: { id: params.id } });
  if (!swap) return NextResponse.json({ error: "Δεν βρέθηκε το αίτημα." }, { status: 404 });
  if (swap.colleagueId !== session.sub) {
    return NextResponse.json({ error: "Μόνο ο συνάδελφος που ζητήθηκε μπορεί να απαντήσει." }, { status: 403 });
  }
  if (swap.status !== "PENDING") {
    return NextResponse.json({ error: "Το αίτημα έχει ήδη απαντηθεί." }, { status: 409 });
  }

  const updated = await prisma.shiftSwap.update({
    where: { id: params.id },
    data: { status: response === "ACCEPT" ? "COLLEAGUE_ACCEPTED" : "COLLEAGUE_DECLINED" },
  });

  return NextResponse.json(updated);
}
