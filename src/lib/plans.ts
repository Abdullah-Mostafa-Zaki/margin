import { Plan } from '@prisma/client';

export type PlanLimits = {
  maxAiTransactions: number;
  maxDrops: number;
  maxTeamMembers: number;
  dataHistoryDays: number;
  basicExpenses: boolean;
  fullExpenses: boolean;
  shopifySync: boolean;
  bostaSync: boolean;
  basicAnalytics: boolean;
  shopifyAnalytics: boolean;
  advancedAnalytics: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  quarterlyReports: boolean;
  yearlyReports: boolean;
};

export const PLAN_PRICES: Record<Plan, number> = {
  FREE: 0,
  PLUS: 500,
  PRO: 1000,
  BUSINESS: 5000,
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxAiTransactions: 20,
    maxDrops: 1,
    maxTeamMembers: 1,
    dataHistoryDays: 30,
    basicExpenses: true,
    fullExpenses: false,
    shopifySync: false,
    bostaSync: false,
    basicAnalytics: true,
    shopifyAnalytics: false,
    advancedAnalytics: false,
    weeklyReports: false,
    monthlyReports: false,
    quarterlyReports: false,
    yearlyReports: false,
  },
  PLUS: {
    maxAiTransactions: 100,
    maxDrops: 5,
    maxTeamMembers: 1,
    dataHistoryDays: 999999,
    basicExpenses: true,
    fullExpenses: true,
    shopifySync: true,
    bostaSync: false,
    basicAnalytics: true,
    shopifyAnalytics: true,
    advancedAnalytics: false,
    weeklyReports: false,
    monthlyReports: true,
    quarterlyReports: false,
    yearlyReports: true,
  },
  PRO: {
    maxAiTransactions: 500,
    maxDrops: 999999,
    maxTeamMembers: 3,
    dataHistoryDays: 999999,
    basicExpenses: true,
    fullExpenses: true,
    shopifySync: true,
    bostaSync: true,
    basicAnalytics: true,
    shopifyAnalytics: true,
    advancedAnalytics: true,
    weeklyReports: false,
    monthlyReports: true,
    quarterlyReports: true,
    yearlyReports: true,
  },
  BUSINESS: {
    maxAiTransactions: 999999,
    maxDrops: 999999,
    maxTeamMembers: 10,
    dataHistoryDays: 999999,
    basicExpenses: true,
    fullExpenses: true,
    shopifySync: true,
    bostaSync: true,
    basicAnalytics: true,
    shopifyAnalytics: true,
    advancedAnalytics: true,
    weeklyReports: true,
    monthlyReports: true,
    quarterlyReports: true,
    yearlyReports: true,
  },
};

export function hasRemainingQuota(org: {
  plan: Plan;
  currentMonthVoice: number;
  currentMonthImage: number;
  currentMonthText: number;
}): boolean {
  const totalUsage = org.currentMonthVoice + org.currentMonthImage + org.currentMonthText;
  return totalUsage < PLAN_LIMITS[org.plan].maxAiTransactions;
}
