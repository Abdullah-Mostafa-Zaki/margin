import { formatCairoDate } from "@/lib/date-utils";

export function groupTransactionsByDate(transactions: {
  date: Date;
  type: string;
  amount: any;
}[]) {
  const grouped: Record<string, { date: string; income: number; expenses: number }> = {};

  transactions.forEach((t) => {
    const dateKey = formatCairoDate(new Date(t.date), "d MMM");

    if (!grouped[dateKey]) {
      grouped[dateKey] = { date: dateKey, income: 0, expenses: 0 };
    }

    if (t.type === 'INCOME') {
      grouped[dateKey].income += Number(t.amount);
    } else {
      grouped[dateKey].expenses += Number(t.amount);
    }
  });

  return Object.values(grouped);
}
