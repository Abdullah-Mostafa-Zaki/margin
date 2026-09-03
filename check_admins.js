require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // fallback
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      memberships: {
        where: { role: 'ADMIN' }
      }
    }
  });

  let zeroAdmins = 0;
  let multipleAdmins = 0;

  for (const org of orgs) {
    if (org.memberships.length === 0) zeroAdmins++;
    if (org.memberships.length > 1) multipleAdmins++;
  }

  console.log(`Total Orgs: ${orgs.length}`);
  console.log(`0 Admins: ${zeroAdmins}`);
  console.log(`>1 Admins: ${multipleAdmins}`);
}
main().then(() => process.exit(0)).catch(console.error);
