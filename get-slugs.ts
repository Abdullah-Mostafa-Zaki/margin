import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.organization.findMany({select:{slug:true}}).then(res => { console.log(res); prisma.$disconnect() });
