"use server";

import prisma from "@/lib/prisma";

export async function connectBostaAccount(email: string, password: string, orgId: string) {
  try {
    const response = await fetch("https://app.bosta.co/api/v2/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return { success: false, error: "Invalid Bosta credentials" };
    }

    const json = await response.json();
    if (!json.success || !json.data?.token || !json.data?.refreshToken) {
      return { success: false, error: "Invalid Bosta credentials" };
    }

    const { token, refreshToken } = json.data;

    await prisma.bostaIntegration.upsert({
      where: { organizationId: orgId },
      update: {
        bostaEmail: email,
        token,
        refreshToken
      },
      create: {
        organizationId: orgId,
        bostaEmail: email,
        token,
        refreshToken
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Bosta connect error:", error);
    return { success: false, error: "An error occurred connecting to Bosta." };
  }
}

export async function refreshBostaToken(orgId: string) {
  const integration = await prisma.bostaIntegration.findUnique({
    where: { organizationId: orgId }
  });

  if (!integration) {
    throw new Error("No Bosta integration found for this organization");
  }

  const response = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: integration.refreshToken })
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Bosta token");
  }

  const json = await response.json();
  if (!json.success || !json.data?.token || !json.data?.refreshToken) {
    throw new Error("Failed to refresh Bosta token");
  }

  const { token, refreshToken } = json.data;

  await prisma.bostaIntegration.update({
    where: { organizationId: orgId },
    data: {
      token,
      refreshToken
    }
  });

  return token;
}
