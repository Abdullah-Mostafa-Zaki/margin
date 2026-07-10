import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: 'zaki' }, include: { tags: true } });
  console.log('Tags for zaki:');
  for (const tag of org.tags) {
    console.log(tag.id, tag.name);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
