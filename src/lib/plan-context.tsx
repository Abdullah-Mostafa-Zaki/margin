"use client";

import { createContext, useContext, ReactNode } from "react";
import { Plan } from "@prisma/client";

const PlanContext = createContext<Plan>("FREE");

export function PlanProvider({
  plan,
  children,
}: {
  plan: Plan;
  children: ReactNode;
}) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

export function usePlan(): Plan {
  return useContext(PlanContext);
}
