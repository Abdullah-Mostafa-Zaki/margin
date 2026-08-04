import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { slug: { in: ["wearmckenz", "zaki", "zaki-4"] } },
    select: { id: true, slug: true, courierFee: true, plan: true }
  });

  for (const org of orgs) {
    const bosta = await prisma.bostaIntegration.findUnique({
      where: { organizationId: org.id }
    });
    console.log(`Org: ${org.slug}, Plan: ${org.plan}, CourierFee: ${org.courierFee}, BostaIntegration: ${bosta ? 'Yes' : 'No'}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
