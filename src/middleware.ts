import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // This function only runs AFTER the authorized callback below returns true
  function middleware(req) {
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");
    const isAuth = !!req.nextauth.token;

    // If a user is already logged in and tries to go to /login, redirect to /onboarding
    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      // This acts as the "Gatekeeper"
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;

        // 1. Define routes that anyone can access (logged in or not)
        const isPublicPath =
          path === "/" ||
          path.startsWith("/login") ||
          path.startsWith("/signup") ||
          path.startsWith("/reset-password") ||
          path.startsWith("/unauthorized") ||
          path.startsWith("/api"); // API routes manage their own security

        if (isPublicPath) {
          return true; // Let them through
        }

        // 2. If it's NOT a public path, they MUST have a token
        return !!token;
      },
    },
  }
);

export const config = {
  // We run this middleware on EVERYTHING except static assets and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};