"use client";

import { useCallback, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/client";
import { formatDate } from "@/lib/format";
import {
  ROLE_LABELS,
  type Role,
} from "@/lib/types";

interface Member {
  id: string;
  role: Role;
  full_name: string | null;
  flat_no: string | null;
  email: string | null;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  flat_no: string | null;
  expires_at: string;
}

interface MembersResponse {
  members: Member[];
  pending_invites: PendingInvite[];
}

export default function MembersView({ viewerId }: { viewerId: string }) {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("resident");
  const [inviteFlat, setInviteFlat] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api<MembersResponse>("/api/members");
      setData(response);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(id: string, role: Role) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/members/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInviteLink(null);
    setCopied(false);
    try {
      const payload: Record<string, unknown> = {
        email: inviteEmail.trim(),
        role: inviteRole,
      };
      if (inviteFlat.trim()) payload.flat_no = inviteFlat.trim();

      const response = await api<{ invite_url: string }>("/api/invites", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setInviteLink(response.invite_url);
      setInviteEmail("");
      setInviteFlat("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 240 }} />;
  if (!data) {
    return (
      <p className="banner banner-error" role="alert">
        {error ?? "Could not load members."}
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 className="h1">Members</h1>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="glass card stack">
        <h2 className="h2">Invite someone</h2>
        <form className="stack" onSubmit={createInvite}>
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="resident@example.com"
            />
          </label>

          <div className="row wrap">
            <label className="field grow" style={{ minWidth: 150 }}>
              <span className="label">Role</span>
              <select
                className="select"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Role)}
              >
                <option value="resident">Resident</option>
                <option value="committee">Committee</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="field grow" style={{ minWidth: 150 }}>
              <span className="label">Flat (optional)</span>
              <input
                className="input"
                value={inviteFlat}
                maxLength={10}
                onChange={(event) => setInviteFlat(event.target.value)}
                placeholder="B-302"
              />
            </label>
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={busy || inviteEmail.trim().length === 0}
          >
            {busy ? "Creating…" : "Create invite link"}
          </button>
        </form>

        {inviteLink ? (
          <div className="stack-sm">
            <span className="label">Invite link (expires in 7 days)</span>
            <input className="input" readOnly value={inviteLink} />
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                } catch {
                  setError("Copy failed — select the link and copy manually.");
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="glass card stack">
        <div className="row-between">
          <h2 className="h2">People</h2>
          <span className="tiny dim">{data.members.length}</span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Flat</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td>
                    {member.full_name ?? "—"}
                    {member.id === viewerId ? (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        you
                      </span>
                    ) : null}
                  </td>
                  <td>{member.flat_no ?? "—"}</td>
                  <td>{member.email ?? "—"}</td>
                  <td>
                    <select
                      className="select"
                      value={member.role}
                      disabled={busy}
                      aria-label={`Role for ${member.full_name ?? member.email ?? "member"}`}
                      onChange={(event) =>
                        changeRole(member.id, event.target.value as Role)
                      }
                    >
                      <option value="resident">{ROLE_LABELS.resident}</option>
                      <option value="committee">{ROLE_LABELS.committee}</option>
                      <option value="admin">{ROLE_LABELS.admin}</option>
                    </select>
                  </td>
                  <td>
                    {member.id === viewerId ? null : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => removeMember(member.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.pending_invites.length > 0 ? (
        <section className="glass card stack">
          <h2 className="h2">Pending invites</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Flat</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>{ROLE_LABELS[invite.role]}</td>
                    <td>{invite.flat_no ?? "—"}</td>
                    <td>{formatDate(invite.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
