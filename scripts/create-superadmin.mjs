// Creates (or resets) the RestroOS super admin, who approves new restaurants at /admin.
//
//   npm run create-superadmin
//
// It asks for the email and password (the password is hidden while you type).
// For scripts/CI you can pass SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD and SUPERADMIN_NAME instead.
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then swallow the echoed characters
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      if (hidden) rl.output.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

const email = (process.env.SUPERADMIN_EMAIL || (await ask("Super admin email: "))).toLowerCase().trim();
const name = process.env.SUPERADMIN_NAME || (await ask("Your name (Enter for \"Super Admin\"): ")) || "Super Admin";
let password = process.env.SUPERADMIN_PASSWORD;
if (!password) {
  password = await ask("Password (at least 10 characters, hidden): ", { hidden: true });
  const again = await ask("Type the password again: ", { hidden: true });
  if (password !== again) {
    console.error("The passwords don't match. Run it again.");
    process.exit(1);
  }
}

if (!email || !email.includes("@")) {
  console.error("Please enter a valid email.");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Use a super admin password of at least 10 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing && existing.role !== "SUPERADMIN") {
    console.error(`${email} already belongs to a ${existing.role} account. Use a different email.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.users.upsert({
    where: { email },
    update: { password: hashed, name, isActive: true },
    create: { email, password: hashed, name, role: "SUPERADMIN", restaurantId: null },
  });
  console.log(`\nSuper admin ready: ${email}\nLog in at http://localhost:3000/login and you'll land on /admin.`);
} finally {
  await prisma.$disconnect();
}
