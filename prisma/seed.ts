import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@company.gr" },
    update: {},
    create: {
      email: "admin@company.gr",
      name: "Διαχειριστής Προσωπικού",
      role: "ADMIN",
      department: "Διοίκηση",
      balanceHours: 160,
      passwordHash,
    },
  });

  const employeesData = [
    { email: "eleni@company.gr", name: "Ελένη Παπαδοπούλου", department: "Πωλήσεις", balanceHours: 160 },
    { email: "giorgos@company.gr", name: "Γιώργος Νικολάου", department: "Αποθήκη", balanceHours: 96 },
    { email: "maria@company.gr", name: "Μαρία Κωνσταντίνου", department: "Πωλήσεις", balanceHours: 128 },
    { email: "dimitris@company.gr", name: "Δημήτρης Αντωνίου", department: "Εξυπηρέτηση", balanceHours: 40 },
    { email: "sofia@company.gr", name: "Σοφία Γεωργίου", department: "Αποθήκη", balanceHours: 152 },
    { email: "kostas@company.gr", name: "Κώστας Παύλου", department: "Πωλήσεις", balanceHours: 112 },
  ];

  for (const e of employeesData) {
    await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: { ...e, role: "EMPLOYEE", passwordHash },
    });
  }

  await prisma.staffingRule.deleteMany({});
  await prisma.staffingRule.create({ data: { minStaff: 4 } });

  console.log("Seed ολοκληρώθηκε.");
  console.log("Admin login: admin@company.gr / password123");
  console.log("Employee login (π.χ.): eleni@company.gr / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
