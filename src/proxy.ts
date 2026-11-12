import { NextResponse, type NextRequest } from "next/server";

// Per-request nonce-based Content-Security-Policy.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const cloud = process.env.FILE_STORAGE === "cloudinary" && /^[A-Za-z0-9_-]{1,80}$/.test(process.env.CLOUDINARY_CLOUD_NAME ?? "") ? process.env.CLOUDINARY_CLOUD_NAME : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google.com",
    "font-src 'self'",
    [
      "connect-src 'self'",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://firebasestorage.googleapis.com",
      "https://content-firebaseappcheck.googleapis.com",
      "https://www.google.com",
      // Uploads go straight from the browser to this lab's own Cloudinary account only (path-restricted).
      cloud ? `https://api.cloudinary.com/v1_1/${cloud}/` : "",
      isDev ? "ws: http://127.0.0.1:* http://localhost:*" : "",
    ].join(" "),
    `frame-src https://www.google.com https://recaptcha.google.com${authDomain ? ` https://${authDomain}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
