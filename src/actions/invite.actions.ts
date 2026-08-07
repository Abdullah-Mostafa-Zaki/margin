"use server";

import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { PLAN_LIMITS } from "@/lib/plans";
import { Role } from "@prisma/client";

export async function createInvite(orgId: string, rawEmail: string, role: Role, inviterId: string) {
  const email = rawEmail.toLowerCase();

  // 1. Fetch organization with members and pending invites to enforce limit
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: true,
      invites: true
    }
  });

  if (!org) {
    return { success: false, error: "Organization not found." };
  }

  const currentMembersCount = org.memberships.length;
  // Count unexpired invites
  const pendingInvitesCount = org.invites.filter(inv => inv.expiresAt > new Date()).length;
  const totalOccupiedSeats = currentMembersCount + pendingInvitesCount;
  
  const limit = PLAN_LIMITS[org.plan].maxTeamMembers;

  if (totalOccupiedSeats >= limit) {
    return { 
      success: false, 
      error: `Team limit reached. Your ${org.plan} plan allows up to ${limit} members. Currently you have ${currentMembersCount} member(s) and ${pendingInvitesCount} pending invite(s).`
    };
  }

  // 2. Check if user already has an active Membership
  const existingMembership = await prisma.membership.findFirst({
    where: {
      organizationId: orgId,
      user: {
        email: email
      }
    }
  });

  if (existingMembership) {
    return { success: false, error: "User is already a member of this organization." };
  }

  // 3. Upsert invite (updates token/expiry if resending)
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.organizationInvite.upsert({
    where: {
      organizationId_email: {
        organizationId: orgId,
        email: email
      }
    },
    update: {
      token,
      expiresAt,
      role,
      invitedById: inviterId
    },
    create: {
      organizationId: orgId,
      email,
      token,
      expiresAt,
      role,
      invitedById: inviterId
    }
  });

  return { success: true, token, email };
}

export async function cancelInvite(inviteId: string, orgId: string) {
  await prisma.organizationInvite.deleteMany({
    where: {
      id: inviteId,
      organizationId: orgId
    }
  });
  return { success: true };
}
