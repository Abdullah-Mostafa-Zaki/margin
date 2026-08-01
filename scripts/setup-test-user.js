const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  const password = await bcrypt.hash('password123', 10);
  let user = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password,
      }
    });
  } else {
    await prisma.user.update({
      where: { email: 'test@example.com' },
      data: { password }
    });
  }

  const org = await prisma.organization.findFirst();
  
  if (org) {
    const mem = await prisma.membership.findFirst({
      where: { userId: user.id, organizationId: org.id }
    });
    if (!mem) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'ADMIN'
        }
      });
    }
    console.log("Test user ready and linked to org:", org.slug);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
