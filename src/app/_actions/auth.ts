"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendResetPasswordEmail } from "@/lib/mail";
import { randomUUID } from "crypto";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string
): Promise<ActionResult> {
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

// ─── Request Password Reset ────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!email) {
    return { success: false, error: "Email is required." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration attacks
  if (!user) {
    return {
      success: true,
      message: "If that email exists, a reset link has been sent.",
    };
  }

  // Delete any existing reset tokens for this email first
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  const token = randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  try {
    await sendResetPasswordEmail(email, token);
  } catch (err) {
    console.error("[requestPasswordReset] Failed to send email:", err);
    return { success: false, error: "Failed to send reset email. Please try again." };
  }

  return {
    success: true,
    message: "If that email exists, a reset link has been sent.",
  };
}

// ─── Reset Password ────────────────────────────────────────────────────────────

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ActionResult> {
  if (!token || !newPassword) {
    return { success: false, error: "Token and new password are required." };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record) {
    return { success: false, error: "Invalid or expired reset link." };
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { success: false, error: "This reset link has expired. Please request a new one." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { email: record.identifier },
    data: { password: hashedPassword },
  });

  // Consume the token — one-time use
  await prisma.verificationToken.delete({ where: { token } });

  return { success: true, message: "Password updated successfully." };
}
