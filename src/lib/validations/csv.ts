import { z } from "zod";

export const csvOrderSchema = z.object({
  shopifyOrderId: z.string().trim().min(1).transform(val => val.replace(/^#/, "").toLowerCase()),
  amount: z.coerce.number().min(0),
  date: z.coerce.date().max(new Date(), { message: "Future dates are invalid" }),
  paymentMethod: z.string().optional(),
  lineItems: z.array(
    z.object({
      name: z.string().trim().min(1),
      quantity: z.coerce.number().min(1),
      price: z.coerce.number().min(0)
    })
  ).min(1),
});

export type CsvOrder = z.infer<typeof csvOrderSchema>;
