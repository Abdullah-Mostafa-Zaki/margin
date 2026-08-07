import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Invalid or missing invite token.", { status: 400 });
  }

  // 1. Find invite by token
  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: true
    }
  });

  if (!invite) {
    return new NextResponse("Invalid invite token.", { status: 400 });
  }

  if (invite.expiresAt < new Date()) {
    // Delete expired token
    await prisma.organizationInvite.delete({ where: { id: invite.id } });
    return new NextResponse("This invite has expired. Please ask your administrator to send a new one.", { status: 400 });
  }

  // 2. Check if user already has an account
  const user = await prisma.user.findUnique({
    where: { email: invite.email }
  });

  if (user) {
    // 3. User exists -> create membership
    const existingMembership = await prisma.membership.findFirst({
      where: {
        organizationId: invite.organizationId,
        userId: user.id
      }
    });

    if (!existingMembership) {
      await prisma.membership.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role
        }
      });
    }

    // Delete the invite
    await prisma.organizationInvite.delete({ where: { id: invite.id } });

    // Redirect to dashboard
    return NextResponse.redirect(new URL(`/${invite.organization.slug}`, request.url));
  } else {
    // 4. User does not exist -> redirect to register with email prepopulated
    // Register page handles accepting pending invites automatically after user creation
    return NextResponse.redirect(new URL(`/register?mode=signup&email=${encodeURIComponent(invite.email)}`, request.url));
  }
}
