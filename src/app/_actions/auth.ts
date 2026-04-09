"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function registerUser(
  email: string,
  password: string
): Promise<RegisterResult> {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  return { success: true };
}
