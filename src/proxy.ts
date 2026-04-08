import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isPublicPage = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/unauthorized");

  if (!token) {
    if (!isAuthPage && !isPublicPage) {
      let callbackUrl = request.nextUrl.pathname;
      if (request.nextUrl.search) callbackUrl += request.nextUrl.search;

      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isAuthPage) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ],
};