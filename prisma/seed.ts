import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aitrainer.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
