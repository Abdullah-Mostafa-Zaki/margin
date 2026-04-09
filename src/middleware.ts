import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes EXCEPT:
     *  - /login, /signup           → public auth pages
     *  - /reset-password           → must be accessible without a session (email link flow)
     *  - /api                      → API routes (handled by their own auth checks)
     *  - /_next/static|image       → Next.js internal assets
     *  - /favicon.ico              → browser default request
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|signup|reset-password).*)",
  ],
};
