import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

// validator ships with express-validator; using it keeps the stored email in
// exactly the form the login/register endpoints normalise to.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validator = require('validator') as { normalizeEmail: (email: string) => string | false };

const prisma = new PrismaClient();

async function main() {
  const rawEmail = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!rawEmail || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const email = validator.normalizeEmail(rawEmail);
  if (!email) throw new Error('ADMIN_EMAIL is not a valid email address.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error(`${email} already exists with role ${existing.role}. Use a different email.`);
    }
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
  console.log(`Admin created: ${email}`);
  console.log('You can now remove ADMIN_PASSWORD from .env.');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());