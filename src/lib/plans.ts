import { Plan } from '@prisma/client';

export type PlanLimits = {
  maxAiReceipts: number;
  maxAiVoice: number;
  maxMembers: number;
  shopifySync: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxAiReceipts: 15,
    maxAiVoice: 15,
    maxMembers: 1,
    shopifySync: false,
    weeklyReports: false,
    monthlyReports: false,
  },
  PLUS: {
    maxAiReceipts: 50,
    maxAiVoice: 50,
    maxMembers: 2,
    shopifySync: false,
    weeklyReports: false,
    monthlyReports: false,
  },
  PRO: {
    maxAiReceipts: 250,
    maxAiVoice: 250,
    maxMembers: 5,
    shopifySync: true,
    weeklyReports: true,
    monthlyReports: true,
  },
  ENTERPRISE: {
    maxAiReceipts: 1000,
    maxAiVoice: 1000,
    maxMembers: Infinity,
    shopifySync: true,
    weeklyReports: true,
    monthlyReports: true,
  },
};
