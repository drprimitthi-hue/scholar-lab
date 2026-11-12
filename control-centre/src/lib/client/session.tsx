"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";

interface Session { loading: boolean; user: User | null; admin: boolean; mfa: boolean; logout: () => Promise<void> }
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState({ loading: true, user: null as User | null, admin: false, mfa: false });
  useEffect(() => onIdTokenChanged(auth(), async (u) => {
    if (!u) return set({ loading: false, user: null, admin: false, mfa: false });
    const t = await u.getIdTokenResult();
    set({ loading: false, user: u, admin: t.claims.role === "superadmin", mfa: Boolean(t.signInSecondFactor) });
  }), []);
  // Sign out after 20 minutes without activity.
  const last = useRef(Date.now());
  useEffect(() => {
    if (!state.user) return;
    const bump = () => (last.current = Date.now());
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    const t = setInterval(() => Date.now() - last.current > 20 * 60_000 && void signOut(auth()), 30_000);
    return () => { window.removeEventListener("mousemove", bump); window.removeEventListener("keydown", bump); clearInterval(t); };
  }, [state.user]);
  const value = useMemo(() => ({ ...state, logout: () => signOut(auth()) }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSession = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("no session");
  return s;
};
