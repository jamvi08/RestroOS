import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Redirects only; pages and API routes do their own permission checks.
export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Waiter portal protection: unauthenticated users accessing /waiter go directly to /waiter/login
    if (path.startsWith("/waiter") && path !== "/waiter/login" && !token) {
      return NextResponse.redirect(new URL("/waiter/login", req.url));
    }

    // Dashboard and super admin protection: unauthenticated users go to /login
    if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true, // Let the proxy function handle tailored redirects
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/waiter/:path*", "/admin/:path*"],
};
