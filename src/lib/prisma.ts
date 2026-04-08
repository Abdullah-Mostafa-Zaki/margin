import { PrismaClient } from "@prisma/client"

const prismaClientSingleton = () => {
  return new PrismaClient().$extends({
    query: {
      transaction: {
        async create({ args, query }: any) {
          if (!args.data.status) {
            args.data.status = args.data.paymentMethod === 'COD' ? 'PENDING' : 'RECEIVED';
          }
          return query(args);
        },
        async createMany({ args, query }: any) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((tx: any) => ({
              ...tx,
              status: tx.status || (tx.paymentMethod === 'COD' ? 'PENDING' : 'RECEIVED')
            }));
          } else {
            const data = args.data as any;
            data.status = data.status || (data.paymentMethod === 'COD' ? 'PENDING' : 'RECEIVED');
          }
          return query(args);
        }
      }
    }
  });
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma
