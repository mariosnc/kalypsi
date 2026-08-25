import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@company.gr" },
    update: {},
    create: {
      email: "admin@company.gr",
      name: "Διαχειριστής Προσωπικού",
      role: "ADMIN",
      department: "Διοίκηση",
      employeeType: "TWP",
      hoursAnnual: 160,
      passwordHash,
    },
  });

  const employeesData = [
    { email: "eleni", name: "Ελένη Παπαδοπούλου", department: "Μονιάτης", shiftGroup: "Λευκή", phone: "99000001", rank: "Πυρ/μος", employeeType: "TWP" as const, hoursAnnual: 160 },
    { email: "giorgos", name: "Γιώργος Νικολάου", department: "Πελένδρι", shiftGroup: "Α", phone: "99000002", rank: "Α/Π", employeeType: "PERMANENT" as const, daysLeave: 20 },
    { email: "maria", name: "Μαρία Κωνσταντίνου", department: "Μονιάτης", shiftGroup: "Πράσινη", phone: "99000003", rank: "Ε/Π", employeeType: "TWP" as const, hoursAnnual: 128 },
    { email: "dimitris", name: "Δημήτρης Αντωνίου", department: "Αγρός", shiftGroup: "Β", phone: "99000004", rank: "Δ/Πυρ.", employeeType: "PERMANENT" as const, daysLeave: 15 },
  ];

  for (const e of employeesData) {
    const { email, ...rest } = e;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, ...rest, role: "EMPLOYEE", passwordHash },
    });
  }

  console.log("Seed ολοκληρώθηκε.");
  console.log("Admin login: admin@company.gr / password123");
  console.log("Employee login (π.χ.): eleni / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
