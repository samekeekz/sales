import { auth } from "@/lib/auth/server"
import { NextRequest } from "next/server"

const protectRoute = auth.middleware({ loginUrl: "/login" })

export default function middleware(request: NextRequest) {
  // Server actions are POST requests with a Next-Action header.
  // The middleware must not intercept them — it would return a redirect
  // instead of the expected server-action JSON, causing
  // "An unexpected response was received from the server."
  if (request.headers.get("next-action")) {
    return
  }
  return protectRoute(request)
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
