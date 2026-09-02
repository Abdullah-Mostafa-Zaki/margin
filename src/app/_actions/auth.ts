"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendResetPasswordEmail, sendWelcomeEmail } from "@/lib/mail";
import { randomUUID } from "crypto";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  phone: string,
  name?: string
): Promise<ActionResult> {
  if (!email || !password || !phone) {
    return { success: false, error: "Email, password, and phone number are required." };
  }

  const emailLower = email.toLowerCase();

  let normalizedPhone = phone.replace(/^0/, "");
  if (!/^1[0125][0-9]{8}$/.test(normalizedPhone)) {
    return { success: false, error: "Invalid Egyptian phone number." };
  }
  const e164Phone = `+20${normalizedPhone}`;

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findFirst({ where: { deletedAt: null, email: emailLower } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: name || undefined,
        email: emailLower,
        phone: e164Phone,
        password: hashedPassword,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002" && err.meta?.target?.includes("phone")) {
      return { success: false, error: "This phone number is already registered." };
    }
    console.error("Failed to create user:", err);
    return { success: false, error: "An unexpected error occurred." };
  }

  // Automatically accept any pending invites for this email
  const pendingInvites = await prisma.organizationInvite.findMany({
    where: { email: emailLower }
  });

  if (pendingInvites.length > 0) {
    for (const invite of pendingInvites) {
      if (invite.expiresAt > new Date()) {
        await prisma.membership.create({
          data: {
            organizationId: invite.organizationId,
            userId: user.id,
            role: invite.role
          }
        });
      }
    }
    // Delete all processed invites
    await prisma.organizationInvite.deleteMany({
      where: { email: emailLower }
    });
  }

  // Await the welcome email so the server action process stays alive long enough to send it.
  // Errors are caught and logged silently to ensure fail-safe execution (non-blocking for the user).
  try {
    await sendWelcomeEmail(emailLower, name || "there");
  } catch (err) {
    console.error("Non-blocking error: Failed to send welcome email", err);
  }

  return { success: true };
}

// ─── Request Password Reset ────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!email) {
    return { success: false, error: "Email is required." };
  }

  const user = await prisma.user.findFirst({ where: { deletedAt: null,  email } });

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

// ─── Save User Phone (Post-Login Gate) ──────────────────────────────────────────

export async function saveUserPhone(phone: string): Promise<ActionResult> {
  if (!phone) {
    return { success: false, error: "Phone number is required." };
  }

  // Need to verify user is logged in
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }

  let normalizedPhone = phone.replace(/^0/, "");
  if (!/^1[0125][0-9]{8}$/.test(normalizedPhone)) {
    return { success: false, error: "Invalid Egyptian phone number." };
  }
  const e164Phone = `+20${normalizedPhone}`;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone: e164Phone },
    });
    return { success: true };
  } catch (err: any) {
    if (err.code === "P2002") {
      return { success: false, error: "This phone number is already registered." };
    }
    console.error("Failed to update user phone:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
