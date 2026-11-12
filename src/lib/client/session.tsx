"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, fs } from "./firebase";
import { DEFAULT_SETTINGS } from "../domain/defaults";
import type { LabSettings, Role, UserDoc } from "../types";

export interface Session {
  loading: boolean;
  user: User | null;
  role: Role | null;
  active: boolean;
  mfa: boolean;
  profile: UserDoc | null;
  settings: LabSettings;
  licence: { level: "ok" | "readonly" | "locked"; reason: string; expiresAt: number | null } | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<{ role: Role | null; active: boolean; mfa: boolean }>({ role: null, active: false, mfa: false });
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [licence, setLicence] = useState<Session["licence"]>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(fs(), "publicSite", "status"),
        (s) => setLicence(s.exists() ? (s.data() as NonNullable<Session["licence"]>) : null),
        () => undefined,
      ),
    [],
  );

  useEffect(
    () =>
      onIdTokenChanged(auth(), async (u) => {
        setUser(u);
        if (!u) {
          setClaims({ role: null, active: false, mfa: false });
          setProfile(null);
          setLoading(false);
          return;
        }
        const t = await u.getIdTokenResult();
        setClaims({
          role: (t.claims.role as Role) ?? null,
          active: t.claims.active === true,
          mfa: Boolean(t.signInSecondFactor),
        });
        setLoading(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(fs(), "users", user.uid),
      (s) => setProfile(s.exists() ? (s.data() as UserDoc) : null),
      () => setProfile(null),
    );
  }, [user]);

  const canReadSettings = claims.active && (claims.role === "scholar" || claims.role === "alumni" || claims.mfa);
  useEffect(() => {
    if (!user || !canReadSettings) return;
    return onSnapshot(
      doc(fs(), "settings", "lab"),
      (s) => setSettings({ ...DEFAULT_SETTINGS, ...((s.data() as Partial<LabSettings>) ?? {}) }),
      () => undefined,
    );
  }, [user, canReadSettings]);

  // Apply the configured accent colour.
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(settings.accent)) document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings.accent]);

  // Idle logout.
  const last = useRef(Date.now());
  useEffect(() => {
    if (!user) return;
    const bump = () => (last.current = Date.now());
    const evs = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last.current > settings.idleMinutes * 60_000) void signOut(auth());
    }, 30_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [user, settings.idleMinutes]);

  const value = useMemo<Session>(
    () => ({
      loading,
      user,
      ...claims,
      profile,
      settings,
      licence,
      refresh: async () => {
        const u = auth().currentUser;
        if (!u) return;
        const t = await u.getIdTokenResult(true);
        setClaims({ role: (t.claims.role as Role) ?? null, active: t.claims.active === true, mfa: Boolean(t.signInSecondFactor) });
      },
      logout: () => signOut(auth()),
    }),
    [loading, user, claims, profile, settings, licence],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
