import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής έχει πρόσβαση." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, department: true, balanceHours: true },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Μόνο ο διαχειριστής μπορεί να προσθέσει χρήστη." }, { status: 403 });
  }

  const { name, email, password, department, balanceHours, role } = await req.json();

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
      balanceHours: Math.round(Number(balanceHours || 0)),
      role: finalRole,
    },
  });

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email, department: user.department, balanceHours: user.balanceHours },
    { status: 201 }
  );
}
