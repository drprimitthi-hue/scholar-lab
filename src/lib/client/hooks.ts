"use client";
import { useEffect, useState } from "react";
import { onSnapshot, type DocumentReference, type Query } from "firebase/firestore";

export interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/** Live query. `key` must change whenever the query changes. Pass null to skip. */
export function useLiveQuery<T>(make: () => Query | null, key: string): Live<T[]> {
  const [state, set] = useState<Live<T[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    const q = make();
    if (!q) {
      set({ data: [], loading: false, error: null });
      return;
    }
    set((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => set({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (err) => set({ data: [], loading: false, error: err.code === "permission-denied" ? "You do not have access to this." : err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useLiveDoc<T>(make: () => DocumentReference | null, key: string): Live<T | null> {
  const [state, set] = useState<Live<T | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    const r = make();
    if (!r) {
      set({ data: null, loading: false, error: null });
      return;
    }
    return onSnapshot(
      r,
      (snap) => set({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (err) => set({ data: null, loading: false, error: err.code === "permission-denied" ? "You do not have access to this." : err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
