"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  inviteIdeaCollaboratorAction,
  loadIdeaCollaboratorsAction,
  lookupCollaboratorEmailAction,
  removeIdeaCollaboratorAction,
  revokeIdeaCollaboratorInviteAction,
  searchCollaboratorDirectoryAction,
  updateIdeaCollaboratorRoleAction,
} from "../actions";
import type { IdeaCollaboratorInviteSummary, IdeaCollaboratorSummary } from "@/lib/db/collaborators";
import type { UserDirectoryMatch } from "@/lib/db/users";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type IdeaSharePanelProps = {
  ideaId: string;
  open: boolean;
  canManage: boolean;
  visibility: "private" | "public";
  onClose: () => void;
  onVisibilityChange: (next: "private" | "public") => Promise<void>;
};

const ROLE_OPTIONS: Array<{ value: "editor" | "commenter" | "viewer"; label: string; description: string }> = [
  { value: "editor", label: "Editor", description: "Can edit idea details and manage features" },
  { value: "commenter", label: "Commenter", description: "Can add comments and suggest updates" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

type EmailLookupState =
  | { kind: "idle" }
  | { kind: "loading"; email: string }
  | { kind: "invalid"; email: string; message: string }
  | { kind: "existing"; email: string; name: string | null; role: string }
  | { kind: "pending_invite"; email: string; name: string | null; role: string; expiresAt: string }
  | { kind: "existing_account"; email: string; name: string | null }
  | { kind: "no_account"; email: string };

const DIRECTORY_DEBOUNCE_MS = 250;

export function IdeaSharePanel({ ideaId, open, canManage, visibility, onClose, onVisibilityChange }: IdeaSharePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<IdeaCollaboratorSummary[]>([]);
  const [invites, setInvites] = useState<IdeaCollaboratorInviteSummary[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "commenter" | "viewer">("commenter");
  const [isSubmitting, startSubmit] = useTransition();
  const [isUpdatingVisibility, startVisibilityTransition] = useTransition();
  const [emailLookup, setEmailLookup] = useState<EmailLookupState>({ kind: "idle" });
  const [directoryMatches, setDirectoryMatches] = useState<UserDirectoryMatch[]>([]);
  const [, startLookupTransition] = useTransition();
  const [isDirectoryPending, startDirectoryTransition] = useTransition();
  const lookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLookupEmailRef = useRef<string>("");

  useEffect(() => {
    if (!open || !canManage || isLoading || collaborators.length || invites.length) {
      return;
    }
    setIsLoading(true);
    void loadIdeaCollaboratorsAction(ideaId)
      .then((result) => {
        setCollaborators(result.collaborators);
        setInvites(result.invites);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to load collaborators");
      })
      .finally(() => setIsLoading(false));
  }, [canManage, collaborators.length, ideaId, invites.length, isLoading, open]);

  useEffect(() => {
    if (!open || !canManage) {
      return;
    }

    if (lookupDebounceRef.current !== null) {
      clearTimeout(lookupDebounceRef.current);
      lookupDebounceRef.current = null;
    }

    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      lastLookupEmailRef.current = "";
      setEmailLookup({ kind: "idle" });
      setDirectoryMatches([]);
      return;
    }

    lookupDebounceRef.current = setTimeout(() => {
      lastLookupEmailRef.current = trimmed.toLowerCase();
      setEmailLookup({ kind: "loading", email: trimmed });

      startLookupTransition(async () => {
        try {
          const response = await lookupCollaboratorEmailAction({ ideaId, email: trimmed });
          if (lastLookupEmailRef.current !== trimmed.toLowerCase()) {
            return;
          }
          if (response.status === "invalid") {
            setEmailLookup({ kind: "invalid", email: trimmed, message: response.error ?? "Enter a valid email address" });
            return;
          }

          const resolution = response.resolution;
          switch (resolution.status) {
            case "existing":
              setEmailLookup({
                kind: "existing",
                email: trimmed,
                name: resolution.user.name ?? resolution.user.email,
                role: resolution.role,
              });
              break;
            case "pending_invite":
              setEmailLookup({
                kind: "pending_invite",
                email: trimmed,
                name: resolution.user?.name ?? resolution.user?.email ?? trimmed,
                role: resolution.invite.role,
                expiresAt: resolution.invite.expiresAt,
              });
              break;
            case "existing_account":
              setEmailLookup({
                kind: "existing_account",
                email: trimmed,
                name: resolution.user.name ?? resolution.user.email,
              });
              break;
            case "no_account":
              setEmailLookup({ kind: "no_account", email: trimmed });
              break;
            default:
              setEmailLookup({ kind: "idle" });
              break;
          }
        } catch (error) {
          if (lastLookupEmailRef.current === trimmed.toLowerCase()) {
            setEmailLookup({ kind: "invalid", email: trimmed, message: error instanceof Error ? error.message : "Unable to verify email right now." });
          }
        }
      });

      if (trimmed.length >= 2) {
        startDirectoryTransition(async () => {
          try {
            const results = await searchCollaboratorDirectoryAction({ ideaId, query: trimmed, limit: 6 });
            if (lastLookupEmailRef.current !== trimmed.toLowerCase()) {
              return;
            }
            setDirectoryMatches(
              results.filter((match) => match.email.toLowerCase() !== trimmed.toLowerCase()),
            );
          } catch (error) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("Directory lookup failed", error);
            }
          }
        });
      } else {
        setDirectoryMatches([]);
      }
    }, DIRECTORY_DEBOUNCE_MS);

    return () => {
      if (lookupDebounceRef.current !== null) {
        clearTimeout(lookupDebounceRef.current);
        lookupDebounceRef.current = null;
      }
    };
  }, [canManage, ideaId, inviteEmail, open, startDirectoryTransition, startLookupTransition]);

  const pendingInviteCount = useMemo(() => invites.length, [invites.length]);

  const inviteButtonDisabled = useMemo(() => {
    if (isSubmitting) {
      return true;
    }
    if (!inviteEmail.trim()) {
      return true;
    }
    if (emailLookup.kind === "loading" || emailLookup.kind === "invalid" || emailLookup.kind === "existing" || emailLookup.kind === "pending_invite") {
      return true;
    }
    return false;
  }, [emailLookup, inviteEmail, isSubmitting]);

  const lookupHelper = useMemo(() => {
    switch (emailLookup.kind) {
      case "loading":
        return {
          tone: "muted" as const,
          icon: <Loader2 className="size-3 animate-spin" aria-hidden="true" />,
          message: "Checking whether this email already has access…",
        };
      case "invalid":
        return {
          tone: "destructive" as const,
          icon: <AlertTriangle className="size-3" aria-hidden="true" />,
          message: emailLookup.message,
        };
      case "existing":
        return {
          tone: "warning" as const,
          icon: <AlertTriangle className="size-3" aria-hidden="true" />,
          message: `${emailLookup.name ?? emailLookup.email} is already part of this idea${emailLookup.role ? ` as ${emailLookup.role}` : ""}.`,
        };
      case "pending_invite": {
        const expiresLabel = new Date(emailLookup.expiresAt).toLocaleDateString();
        return {
          tone: "warning" as const,
          icon: <AlertTriangle className="size-3" aria-hidden="true" />,
          message: `An invite is already pending${emailLookup.name ? ` for ${emailLookup.name}` : ""}. It expires ${expiresLabel}.`,
        };
      }
      case "existing_account":
        return {
          tone: "success" as const,
          icon: <CheckCircle2 className="size-3" aria-hidden="true" />,
          message: `${emailLookup.name ?? emailLookup.email} is a verified Coda account. Sending will grant ${inviteRole} access immediately.`,
        };
      case "no_account":
        return {
          tone: "muted" as const,
          icon: <Mail className="size-3" aria-hidden="true" />,
          message: "We’ll email them a magic link so they can create an account and join this idea.",
        };
      default:
        return null;
    }
  }, [emailLookup, inviteRole]);

  const suggestionStatusMap: Record<UserDirectoryMatch["status"], { label: string; tone: "warning" | "success" | "muted" }> = {
    existing: { label: "Already on team", tone: "warning" },
    pending_invite: { label: "Invite pending", tone: "warning" },
    invitable: { label: "Verified account", tone: "success" },
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    if (emailLookup.kind === "invalid") {
      toast.error(emailLookup.message);
      return;
    }
    if (emailLookup.kind === "existing") {
      toast.error(`${emailLookup.name ?? emailLookup.email} is already part of this idea.`);
      return;
    }
    if (emailLookup.kind === "pending_invite") {
      toast.error("An invitation is already pending for that email.");
      return;
    }
    if (emailLookup.kind === "loading") {
      toast.error("Hang tight—still verifying that email.");
      return;
    }
    startSubmit(async () => {
      try {
        const result = await inviteIdeaCollaboratorAction({ ideaId, email: inviteEmail.trim(), role: inviteRole });
        if (result.type === "collaborator") {
          setCollaborators((previous) => {
            const existingIndex = previous.findIndex((item) => item.userId === result.collaborator.userId);
            if (existingIndex >= 0) {
              const next = previous.slice();
              next[existingIndex] = result.collaborator;
              return next;
            }
            return [...previous, result.collaborator];
          });
          toast.success("Collaborator added");
        } else {
          setInvites((previous) => {
            const existingIndex = previous.findIndex((item) => item.email === result.invite.email);
            if (existingIndex >= 0) {
              const next = previous.slice();
              next[existingIndex] = result.invite;
              return next;
            }
            return [...previous, result.invite];
          });
          toast.success("Invite sent");
        }
        setInviteEmail("");
        setEmailLookup({ kind: "idle" });
        setDirectoryMatches([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to invite collaborator");
      }
    });
  };

  const handleRoleChange = (collaboratorId: string, role: "editor" | "commenter" | "viewer") => {
    startSubmit(async () => {
      try {
        const updated = await updateIdeaCollaboratorRoleAction({ ideaId, collaboratorId, role });
        setCollaborators((previous) => previous.map((collaborator) => (collaborator.id === collaboratorId ? updated : collaborator)));
        toast.success("Role updated");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update role");
      }
    });
  };

  const handleRemove = (collaboratorId: string) => {
    startSubmit(async () => {
      try {
        await removeIdeaCollaboratorAction({ ideaId, collaboratorId });
        setCollaborators((previous) => previous.filter((collaborator) => collaborator.id !== collaboratorId));
        toast.success("Collaborator removed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to remove collaborator");
      }
    });
  };

  const handleRevokeInvite = (inviteId: string) => {
    startSubmit(async () => {
      try {
        await revokeIdeaCollaboratorInviteAction({ ideaId, inviteId });
        setInvites((previous) => previous.filter((invite) => invite.id !== inviteId));
        toast.success("Invite revoked");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to revoke invite");
      }
    });
  };

  const copyInviteLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/dashboard/ideas/${ideaId}?invite=${token}`;
    void navigator.clipboard.writeText(url)
      .then(() => toast.success("Invite link copied"))
      .catch(() => toast.error("Unable to copy invite link"));
  };

  const toggleVisibility = (next: "private" | "public") => {
    if (next === visibility) return;
    startVisibilityTransition(async () => {
      try {
        await onVisibilityChange(next);
        toast.success(next === "public" ? "Idea is now public" : "Idea is now private");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update visibility");
      }
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Share idea</h3>
          <p className="text-sm text-muted-foreground">Invite teammates or generate a view-only link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", visibility === "public" ? "border-emerald-400/60 bg-emerald-950/30 text-emerald-200" : "border-slate-600 bg-slate-900 text-slate-200") }>
            {visibility === "public" ? "Public" : "Private"}
          </span>
          {canManage ? (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="interactive-btn h-7"
                disabled={isUpdatingVisibility || visibility === "public"}
                onClick={() => toggleVisibility("public")}
              >
                Make public
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="interactive-btn h-7"
                disabled={isUpdatingVisibility || visibility === "private"}
                onClick={() => toggleVisibility("private")}
              >
                Make private
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="interactive-btn">
            Close
          </Button>
        </div>
      </div>

      {canManage ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invite by email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
                className="mt-1"
              />
              <div className="mt-2 space-y-2 text-xs">
                {lookupHelper ? (
                  <p
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1",
                      lookupHelper.tone === "destructive"
                        ? "bg-destructive/10 text-destructive"
                        : lookupHelper.tone === "warning"
                          ? "bg-amber-500/10 text-amber-200"
                          : lookupHelper.tone === "success"
                            ? "bg-emerald-500/10 text-emerald-200"
                            : "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {lookupHelper.icon}
                    {lookupHelper.message}
                  </p>
                ) : null}
                {directoryMatches.length > 0 ? (
                  <div className="rounded-md border border-border/60 bg-muted/5">
                    <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suggestions</p>
                    <ul className="divide-y divide-border/60">
                      {directoryMatches.map((match) => {
                        const descriptor = suggestionStatusMap[match.status];
                        return (
                          <li key={match.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
                              onClick={() => {
                                setInviteEmail(match.email);
                                setDirectoryMatches([]);
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{match.name ?? match.email}</p>
                                <p className="text-xs text-muted-foreground">{match.email}</p>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                                  descriptor.tone === "success"
                                    ? "bg-emerald-500/10 text-emerald-200"
                                    : descriptor.tone === "warning"
                                      ? "bg-amber-500/10 text-amber-200"
                                      : "bg-muted/80 text-muted-foreground",
                                )}
                              >
                                <UserPlus className="size-3" aria-hidden="true" />
                                {descriptor.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {isDirectoryPending && inviteEmail.trim().length >= 2 ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    Searching directory…
                  </p>
                ) : null}
              </div>
            </div>
            <div className="sm:w-40">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</label>
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "editor" | "commenter" | "viewer")}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              className="sm:h-11"
              disabled={inviteButtonDisabled}
              onClick={handleInvite}
            >
              {isSubmitting ? "Sending…" : "Send invite"}
            </Button>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            {ROLE_OPTIONS.map((option) => (
              <p key={option.value}>
                <span className="font-semibold text-foreground">{option.label}:</span> {option.description}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Only the idea owner can invite collaborators.
        </p>
      )}

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Collaborators</h4>
          <span className="text-xs text-muted-foreground">{collaborators.length} total</span>
        </div>
        <div className="space-y-2">
          {collaborators.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              No collaborators yet.
            </p>
          ) : (
            collaborators.map((collaborator) => (
              <div
                key={collaborator.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {collaborator.name || collaborator.email || collaborator.userId}
                    {collaborator.isSelf ? <span className="ml-2 text-xs text-muted-foreground">(You)</span> : null}
                  </p>
                  {collaborator.email ? (
                    <p className="text-xs text-muted-foreground">{collaborator.email}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={collaborator.role === "owner" ? "owner" : collaborator.role}
                    disabled={!canManage || collaborator.isOwner || isSubmitting}
                    onChange={(event) => handleRoleChange(collaborator.id, event.target.value as "editor" | "commenter" | "viewer")}
                    className="rounded-md border border-input bg-background px-2 py-2 text-sm disabled:opacity-75"
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="commenter">Commenter</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {canManage && !collaborator.isOwner ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleRemove(collaborator.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Pending invites</h4>
          <span className="text-xs text-muted-foreground">{pendingInviteCount}</span>
        </div>
        {pendingInviteCount === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No pending invites.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Role: <span className="font-semibold text-foreground capitalize">{invite.role}</span> • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => copyInviteLink(invite.token)}>
                    Copy link
                  </Button>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
