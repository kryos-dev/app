import { NextResponse, type NextRequest } from "next/server"
import { validateCsrfToken } from "./lib/csrf"

// No session check here any more. Caddy asks the access service's /authz
// endpoint about every request to chat.kryos.dev before this process sees it, so
// a request that arrives is a request that was allowed -- and a redirect to a
// login page this app no longer serves would only be a loop. Identity comes from
// the header Caddy sets; see lib/auth/index.ts.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // CSRF protection for state-changing requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const csrfCookie = request.cookies.get("csrf_token")?.value
    const headerToken = request.headers.get("x-csrf-token")

    if (!csrfCookie || !headerToken || !validateCsrfToken(headerToken)) {
      return new NextResponse("Invalid CSRF token", { status: 403 })
    }
  }

  const isDev = process.env.NODE_ENV === "development"

  response.headers.set(
    "Content-Security-Policy",
    isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://assets.onedollarstats.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.github.com https://collector.onedollarstats.com;`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://analytics.umami.is https://vercel.live https://assets.onedollarstats.com; frame-src 'self' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api-gateway.umami.dev https://api.github.com https://collector.onedollarstats.com;`
  )

  return response
}

export const config = {
  matcher: [
    // `_next` as a whole, not just static/image: everything the framework
    // serves under it (chunks, hmr, RSC payloads) is its own traffic and has
    // no user to resolve, so running the auth middleware on it only costs a
    // lookup per asset.
    "/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
  runtime: "nodejs",
}
