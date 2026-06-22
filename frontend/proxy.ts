import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/queues/display"]);
const ADMIN_PATH_PREFIXES = ["/staff", "/audit-logs"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const session = request.cookies.get("radiology_session")?.value;

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session) return NextResponse.next();

  const user = await verifySession(session);
  if (!user) {
    const response = isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("radiology_session", "", { path: "/", maxAge: 0 });
    return response;
  }

  if (pathname === "/" || pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (ADMIN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

async function verifySession(session: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Cookie: `radiology_session=${encodeURIComponent(session)}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data as { role?: string } | undefined;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
