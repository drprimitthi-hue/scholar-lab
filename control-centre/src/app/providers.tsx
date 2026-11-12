"use client";
import { SessionProvider } from "@/lib/client/session";
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
