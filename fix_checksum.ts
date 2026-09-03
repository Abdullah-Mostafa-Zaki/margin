import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const checksum = 'eb6a6a87583cf78b90fa4b961b77551bd7baa93516c2d617bcf249eae5109140';
  console.log('Fixing checksum for 0_baseline...');
  
  const result = await prisma.$executeRaw`UPDATE _prisma_migrations SET checksum = ${checksum} WHERE migration_name = '0_baseline'`;
  
  console.log(`Updated ${result} rows in _prisma_migrations.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
