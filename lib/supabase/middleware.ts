import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isPublic =
        pathname.startsWith("/api/users/auth/") ||
        pathname === "/" ||
        pathname.startsWith("/auth/") ||
        pathname.startsWith("/api/");

    // Check for session_id cookie (DB-only token approach)
    const sessionId = request.cookies.get("session_id")?.value;
    console.log("[mw] path", pathname, { isPublic, hasSession: !!sessionId });

    if (pathname.startsWith("/auth/")) {
        if (sessionId) {
            const url = request.nextUrl.clone();
            url.pathname = "/protected";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    if (isPublic) {
        return NextResponse.next();
    }

    if (!sessionId) {
        console.log("[mw] no session, redirect to login");
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";
        return NextResponse.redirect(url);
    }

    console.log("[mw] session present; allowing", pathname);
    return NextResponse.next();
}
