"use client";
import { api } from "@/lib/client/api";
import { usePresenceOn } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatTime, todayInTz } from "@/lib/domain/dates";
import { Button, Card, ErrorText, useAction } from "./ui";

function position(): Promise<{ lat: number; lng: number }> {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => rej(new Error("Location permission is needed to check in.")),
      { enableHighAccuracy: true, timeout: 15000 },
    ),
  );
}

export function CheckInCard() {
  const s = useSession();
  const today = todayInTz(s.settings.timezone);
  const { data } = usePresenceOn(today);
  const p = data[0];
  const a = useAction();

  async function act(action: "in" | "out") {
    await a.run(async () => {
      const loc = s.settings.geofence.enabled ? await position() : {};
      await api("/api/presence", "POST", { action, ...loc });
    });
  }

  return (
    <Card title="Today">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <p>Check-in: <span className="font-medium">{formatTime(p?.checkIn, s.settings.timezone)}</span></p>
          <p>Check-out: <span className="font-medium">{formatTime(p?.checkOut, s.settings.timezone)}</span></p>
        </div>
        {!p?.checkIn ? (
          <Button onClick={() => act("in")} disabled={a.busy}>Check in</Button>
        ) : !p.checkOut ? (
          <Button variant="soft" onClick={() => act("out")} disabled={a.busy}>Check out</Button>
        ) : (
          <span className="text-sm text-ok">Done for today</span>
        )}
      </div>
      <div className="mt-2"><ErrorText>{a.error}</ErrorText></div>
    </Card>
  );
}
