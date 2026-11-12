"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { Spinner } from "@/components/ui";

export default function Me() {
  const s = useSession();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (s.user) router.replace(`/scholars/${s.user.uid}${params.get("tab") ? `?tab=${params.get("tab")}` : ""}`);
  }, [s.user, router, params]);
  return <Spinner />;
}
