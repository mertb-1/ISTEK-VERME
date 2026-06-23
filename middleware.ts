import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPaths = ["/dashboard", "/rfq", "/suppliers", "/profile", "/orders"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Supabase auth cookie — proje ID'sine göre isim: sb-<ref>-auth-token
  const projectRef = "rfjdzutefamucwyfxgvq";
  const authCookie =
    request.cookies.get(`sb-${projectRef}-auth-token`) ??
    request.cookies.get(`sb-${projectRef}-auth-token.0`);

  if (!authCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|quote).*)",
  ],
};
