import { Plan } from '@prisma/client';

export type PlanLimits = {
  maxAiReceipts: number;
  maxAiVoice: number;
  maxAiText: number;
  maxMembers: number;
  shopifySync: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxAiReceipts: 15,
    maxAiVoice: 15,
    maxAiText: 30,
    maxMembers: 1,
    shopifySync: false,
    weeklyReports: false,
    monthlyReports: false,
  },
  PLUS: {
    maxAiReceipts: 50,
    maxAiVoice: 50,
    maxAiText: 100,
    maxMembers: 2,
    shopifySync: false,
    weeklyReports: false,
    monthlyReports: false,
  },
  PRO: {
    maxAiReceipts: 250,
    maxAiVoice: 250,
    maxAiText: 500,
    maxMembers: 5,
    shopifySync: true,
    weeklyReports: true,
    monthlyReports: true,
  },
  ENTERPRISE: {
    maxAiReceipts: 1000,
    maxAiVoice: 1000,
    maxAiText: 2000,
    maxMembers: Infinity,
    shopifySync: true,
    weeklyReports: true,
    monthlyReports: true,
  },
};

export function hasRemainingQuota(
  plan: Plan,
  type: 'receipts' | 'voice' | 'text',
  currentUsage: number
): boolean {
  let limit: number;
  if (type === 'receipts') limit = PLAN_LIMITS[plan].maxAiReceipts;
  else if (type === 'voice')  limit = PLAN_LIMITS[plan].maxAiVoice;
  else                        limit = PLAN_LIMITS[plan].maxAiText;
  return currentUsage < limit;
}
