"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useUsers } from "@/lib/client/data";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Notice, PageHeader, Spinner, useAction } from "@/components/ui";
import { Reauth } from "@/components/Reauth";
import { TempPassword } from "@/components/TempPassword";

function AddMentor({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temp, setTemp] = useState<string | null>(null);
  const a = useAction();
  if (temp) return <div className="space-y-4"><TempPassword email={email.toLowerCase()} password={temp} /><Button onClick={onClose}>Done</Button></div>;
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await a.run(async () => setTemp((await api<{ tempPassword: string }>("/api/admin/users", "POST", { role: "mentor", name, email })).tempPassword)); }}>
      <p className="text-sm text-muted">Mentors (e.g. senior PhD scholars) review the work of scholars you assign to them. They must use two-factor sign-in.</p>
      <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>Create mentor account</Button>
    </form>
  );
}

export default function PeoplePage() {
  const { data, loading, error } = useUsers();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  const a = useAction();
  const [mfaReset, setMfaReset] = useState<{ uid: string; email: string } | null>(null);
  const act = (uid: string, email: string, action: string) =>
    a.run(async () => {
      const r = await api<{ tempPassword?: string }>(`/api/admin/users/${uid}`, "PATCH", { action });
      if (r.tempPassword) setTemp({ email, pw: r.tempPassword });
    }, "Done");

  if (loading) return <Spinner />;
  const order = { supervisor: 0, mentor: 1, scholar: 2, alumni: 3 } as const;
  const list = [...data].sort((x, y) => order[x.role] - order[y.role] || x.name.localeCompare(y.name));
  return (
    <>
      <PageHeader title="Accounts" subtitle="Sign-in accounts for mentors, scholars and alumni" action={<Button onClick={() => setOpen(true)}>Add mentor</Button>} />
      <Card>
        <ErrorText>{error || a.error}</ErrorText>
        <Notice>{a.done}</Notice>
        {temp && <div className="mb-4"><TempPassword email={temp.email} password={temp.pw} /></div>}
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.uid} className="border-b border-line/60 last:border-0">
                <td className="py-2.5">{u.role === "scholar" || u.role === "alumni" ? <Link className="font-medium hover:text-accent" href={`/scholars/${u.uid}`}>{u.name}</Link> : <span className="font-medium">{u.name}</span>}<div className="text-xs text-muted">{u.email}</div></td>
                <td><Badge>{u.role}</Badge></td>
                <td><Badge tone={u.status === "active" ? "ok" : "warn"}>{u.status.replace("_", " ")}</Badge>{u.mustChangePassword && <span className="ml-1 text-xs text-muted">awaiting first sign-in</span>}</td>
                <td className="space-x-2 text-right">
                  {u.role !== "supervisor" && u.status !== "pending_deletion" && (
                    <>
                      {u.status === "active" ? <Button variant="ghost" className="px-2 py-1" onClick={() => act(u.uid, u.email, "disable")}>Disable</Button> : <Button variant="ghost" className="px-2 py-1" onClick={() => act(u.uid, u.email, "enable")}>Enable</Button>}
                      <Button variant="ghost" className="px-2 py-1" onClick={() => act(u.uid, u.email, "reset_password")}>Reset password</Button>
                      {u.role === "mentor" && <Button variant="ghost" className="px-2 py-1" onClick={() => confirm(`Remove ${u.name}'s authenticator? They will set up 2FA again at their next sign-in.`) && setMfaReset({ uid: u.uid, email: u.email })}>Reset 2FA</Button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={!!mfaReset} onClose={() => setMfaReset(null)} title="Confirm it’s you">{mfaReset && <Reauth label="Confirm and reset 2FA" onDone={() => { const m = mfaReset; setMfaReset(null); void act(m.uid, m.email, "reset_2fa"); }} />}</Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="Add mentor">{open && <AddMentor onClose={() => setOpen(false)} />}</Modal>
    </>
  );
}
