import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/verify", "/onboarding"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("neurova_token")?.value
        ?? request.headers.get("authorization")?.split(" ")[1];

    const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
    const isAuthenticated = !!token;

    // Redirect unauthenticated users to login
    if (!isAuthenticated && !isPublicRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
    }



    // Redirect authenticated users away from auth pages
    if (isAuthenticated && isPublicRoute) {
        return NextResponse.redirect(new URL("/conversations", request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Run middleware on all routes except static files and API routes
    matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};