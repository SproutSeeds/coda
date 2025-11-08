"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Funnel,
  Globe2,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Sparkles,
  Users,
  Star,
  StarOff,
  Lock,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";
import { cn } from "@/lib/utils";

import {
  convertIdeaToFeatureAction,
  deleteIdeaAction,
  exportIdeaAsJsonAction,
  listIdeaOptionsAction,
  restoreDeletedFeatureAction,
  restoreIdeaAction,
  cycleIdeaStarAction,
  updateIdeaAction,
  submitJoinRequestAction,
  listJoinRequestsAction,
  markJoinRequestsSeenAction,
  resolveJoinRequestAction,
  archiveJoinRequestAction,
} from "../actions";
import { FeatureComposer } from "./FeatureComposer";
import { FeatureList } from "./FeatureList";
import { showUndoToast } from "./UndoSnackbar";
import type { Feature, Idea, JoinRequest, JoinRequestCounts } from "./types";
import { IdeaDevPanel } from "./IdeaDevPanel";
import { IdeaSharePanel } from "./IdeaSharePanel";
import { useOthers, useUpdateMyPresence } from "@liveblocks/react/suspense";
import type { IdeaUserMetadata } from "@/lib/liveblocks/types";

let didWarnMissingLiveblocks = false;

function useOptionalIdeaCollaboration(enabled: boolean) {
  try {
    const updatePresence = useUpdateMyPresence();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const others = useOthers();
    if (!enabled) {
      return null;
    }
    return { updatePresence, others } as const;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const isMissingProvider = error instanceof Error && error.message.includes("RoomProvider is missing");
      if (!isMissingProvider && !didWarnMissingLiveblocks) {
        console.warn("[IdeaDetail] Liveblocks unavailable, collaboration features disabled.", error);
        didWarnMissingLiveblocks = true;
      }
    }
    return null;
  }
}

function formatDateTime(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function buildIdeaExportFilename(title: string | null | undefined, id: string) {
  const trimmed = (title ?? "").trim();
  const normalized = trimmed
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = normalized.toLowerCase();
  const safeTitle = slug.length > 0 ? slug.slice(0, 80) : "untitled";
  return `${safeTitle}-idea-${id}.json`;
}

const featureSortOptions = [
  { value: "priority", label: "Manual priority" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "title_asc", label: "Title A→Z" },
] as const;

const featureFilterOptions: Array<{ value: "all" | "completed" | "starred" | "unstarred"; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "starred", label: "Starred" },
  { value: "unstarred", label: "Unstarred" },
];

type LiveblocksMember = {
  id: string;
  info?: unknown;
  presence?: Record<string, unknown> | null | undefined;
};

const EMPTY_OTHERS: LiveblocksMember[] = [];

const AUTOSAVE_DELAY = 10_000;

function getCollaboratorDisplayName(meta?: IdeaUserMetadata | null) {
  if (!meta) {
    return "Collaborator";
  }
  if (meta.name && meta.name.trim().length > 0) {
    return meta.name.trim();
  }
  if (meta.email && meta.email.trim().length > 0) {
    return meta.email.trim();
  }
  return "Collaborator";
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0] ?? "").concat(parts[1]![0] ?? "").toUpperCase();
}

export function IdeaDetail({
  idea,
  features,
  deletedFeatures,
  viewerJoinRequest,
  collaborationEnabled,
  ownerJoinRequestCounts,
  ownerInviteCount,
}: {
  idea: Idea;
  features: Feature[];
  deletedFeatures: Feature[];
  viewerJoinRequest: JoinRequest | null;
  collaborationEnabled: boolean;
  ownerJoinRequestCounts: JoinRequestCounts | null;
  ownerInviteCount: number;
}) {
  const router = useRouter();
  const collaboration = useOptionalIdeaCollaboration(collaborationEnabled);
  const updatePresence = collaboration?.updatePresence;
  const others = (collaboration?.others as LiveblocksMember[] | undefined) ?? EMPTY_OTHERS;
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes);
  const [githubDraft, setGithubDraft] = useState(idea.githubUrl ?? "");
  const [isEditingGithub, setIsEditingGithub] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [featureQuery, setFeatureQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState<"all" | "completed" | "starred" | "unstarred">("all");
  const [featureView, setFeatureView] = useState<"active" | "deleted">("active");
  const [featureSort, setFeatureSort] = useState<(typeof featureSortOptions)[number]["value"]>("priority");
  const [showFilters, setShowFilters] = useState(false);
  const [linkLabelDraft, setLinkLabelDraft] = useState(idea.linkLabel ?? "GitHub Repository");
  const [syncedIdea, setSyncedIdea] = useState({
    title: idea.title,
    notes: idea.notes,
    githubUrl: idea.githubUrl ?? "",
    linkLabel: idea.linkLabel ?? "GitHub Repository",
    updatedAt: idea.updatedAt,
    starred: idea.starred,
    superStarred: idea.superStarred,
    visibility: idea.visibility,
  });
  const ideaAutoTimer = useRef<number | null>(null);
  const githubAutoTimer = useRef<number | null>(null);
  const ideaSaveInFlight = useRef(false);
  const [ideaAutoState, setIdeaAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [githubAutoState, setGithubAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertOptions, setConvertOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedConvertId, setSelectedConvertId] = useState<string>("");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isLoadingConvertOptions, startLoadConvertOptions] = useTransition();
  const [isConverting, startConvertTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const [isConvertDropdownOpen, setIsConvertDropdownOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDevModeExpanded, setIsDevModeExpanded] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(viewerJoinRequest);
  const [isJoinSubmitting, startJoinRequestTransition] = useTransition();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const convertDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isIdVisible, setIsIdVisible] = useState(false);
  const [deletedFeaturesState, setDeletedFeaturesState] = useState(deletedFeatures);
  const [isRestoringFeature, startRestoreFeatureTransition] = useTransition();
  const [isStarPending, startStarTransition] = useTransition();
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isJoinQueueOpen, setIsJoinQueueOpen] = useState(false);
  const [joinRequestCounts, setJoinRequestCounts] = useState<JoinRequestCounts | null>(ownerJoinRequestCounts);
  const [ownerJoinRequests, setOwnerJoinRequests] = useState<JoinRequest[] | null>(null);
  const ownerJoinRequestsRef = useRef<JoinRequest[] | null>(ownerJoinRequests);
  const [pendingInvites, setPendingInvites] = useState(ownerInviteCount);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [roleDrafts, setRoleDrafts] = useState<Record<string, "editor" | "commenter" | "viewer">>({});
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [resolvingAction, setResolvingAction] = useState<"approve" | "reject" | "archive" | null>(null);
  const [isLoadingJoinRequests, startLoadJoinRequests] = useTransition();
  const [isResolvingJoinRequest, startResolveJoinRequest] = useTransition();
  const canWrite = idea.isOwner || idea.accessRole === "editor";
  const canManageCollaborators = idea.isOwner;
  const joinRequestStatus = joinRequest?.status ?? null;
  const hasPendingJoinRequest = joinRequestStatus === "pending";
  const hasApprovedJoinRequest = joinRequestStatus === "approved";
  const canRequestToJoin =
    !canWrite && !idea.isOwner && idea.accessRole === "viewer" && idea.visibility === "public";
  const joinQueuePending = joinRequestCounts?.pending ?? 0;
  const joinQueueUnseen = joinRequestCounts?.unseen ?? 0;
  const showJoinQueueIndicator = canManageCollaborators && (joinQueuePending > 0 || joinQueueUnseen > 0);
  const showShareIndicator = canManageCollaborators && pendingInvites > 0;
  const joinMessageTrimmed = joinMessage.trim();
  const joinMessageLength = joinMessageTrimmed.length;
  const joinMessageTooShort = joinMessageLength > 0 && joinMessageLength < 20;
  const joinMessageTooLong = joinMessageLength > 1000;
  const collaboratorAvatars = useMemo(() =>
    others.map((member) => {
      const info = member.info as IdeaUserMetadata | null | undefined;
      const name = getCollaboratorDisplayName(info);
      return {
        id: member.id,
        name,
        initials: getInitials(name),
        status:
          typeof member.presence === "object" && member.presence && "status" in member.presence
            ? ((member.presence as { status?: string | null }).status ?? "viewing")
            : "viewing",
      };
    }),
  [others]);
  const visibleAvatars = collaboratorAvatars.slice(0, 4);
  const extraCollaborators = collaboratorAvatars.length - visibleAvatars.length;
  const corePlanPreview = useMemo(() => {
    const text = (syncedIdea.notes ?? "").trim();
    if (!text) return "";
    if (text.length <= 200) return text;
    return `${text.slice(0, 200)}…`;
  }, [syncedIdea.notes]);
  const blurActiveElement = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }, []);

  useEffect(() => {
    const nextGithub = idea.githubUrl ?? "";
    setTitle(idea.title);
    setNotes(idea.notes);
    setGithubDraft(nextGithub);
    setSyncedIdea({
      title: idea.title,
      notes: idea.notes,
      githubUrl: nextGithub,
      linkLabel: idea.linkLabel ?? "GitHub Repository",
      updatedAt: idea.updatedAt,
      starred: idea.starred,
      superStarred: idea.superStarred,
      visibility: idea.visibility,
    });
    setLinkLabelDraft(idea.linkLabel ?? "GitHub Repository");
    setIdeaAutoState("idle");
    setGithubAutoState("idle");
    setIsIdVisible(false);
  }, [idea.githubUrl, idea.id, idea.linkLabel, idea.notes, idea.starred, idea.superStarred, idea.title, idea.updatedAt, idea.visibility]);

  useEffect(() => {
    if (!updatePresence) {
      return;
    }
    updatePresence({
      status: isEditing ? "editing" : "viewing",
      focus: isEditing ? { type: "idea" } : null,
      role: idea.accessRole,
    });
  }, [idea.accessRole, isEditing, updatePresence]);

  useEffect(() => {
    setIsShareOpen(false);
  }, [idea.id]);

  useEffect(() => {
    if (!canManageCollaborators && isShareOpen) {
      setIsShareOpen(false);
    }
  }, [canManageCollaborators, isShareOpen]);

  useEffect(() => {
    setJoinRequest(viewerJoinRequest);
    if (viewerJoinRequest?.status === "pending") {
      setIsJoinOpen(false);
      setJoinMessage("");
    }
  }, [viewerJoinRequest]);

  useEffect(() => {
    if (canWrite) {
      return;
    }
    if (isEditing) {
      setIsEditing(false);
    }
    if (isEditingGithub) {
      setIsEditingGithub(false);
    }
    if (isConvertOpen) {
      setIsConvertOpen(false);
    }
    if (isActionsOpen) {
      setIsActionsOpen(false);
    }
  }, [canWrite, isActionsOpen, isConvertOpen, isEditing, isEditingGithub]);

  useEffect(() => {
    if (!isActionsOpen) {
      setIsDevModeExpanded(false);
    }
  }, [isActionsOpen]);

  useEffect(() => {
    setDeletedFeaturesState(deletedFeatures);
  }, [deletedFeatures]);

  useEffect(() => {
    setPendingInvites(ownerInviteCount);
  }, [ownerInviteCount]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/devmode/runners/online", { cache: "no-store" as RequestCache });
        if (res.ok) {
          const data = await res.json();
          setIsOnline(!!data.online);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!showFilters) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!filterPanelRef.current) return;
      if (
        filterPanelRef.current.contains(target) ||
        (filterTriggerRef.current && filterTriggerRef.current.contains(target))
      ) {
        return;
      }
      setShowFilters(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        blurActiveElement();
        setShowFilters(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [blurActiveElement, showFilters]);

  const createdAt = useMemo(() => formatDateTime(idea.createdAt), [idea.createdAt]);
  const updatedAt = useMemo(() => formatDateTime(idea.updatedAt), [idea.updatedAt]);
  const characterCount = notes.length;
  const notesLimitExceeded = characterCount > IDEA_NOTES_CHARACTER_LIMIT;
  const trimmedGithub = githubDraft.trim();
  const githubUrlNormalized = trimmedGithub === "" ? null : trimmedGithub;
  const ideaDirty = title !== syncedIdea.title || notes !== syncedIdea.notes;
  const trimmedLinkLabel = linkLabelDraft.trim();
  const githubDirty =
    trimmedGithub !== syncedIdea.githubUrl || trimmedLinkLabel !== syncedIdea.linkLabel;
  const linkLabelDisplay = isEditingGithub
    ? linkLabelDraft || "Title of URL"
    : syncedIdea.linkLabel;

  const maskedId = useMemo(() => {
    if (idea.id.length <= 6) {
      return idea.id;
    }
    const visible = idea.id.slice(-6);
    return `${"*".repeat(idea.id.length - 6)}${visible}`;
  }, [idea.id]);

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(idea.id);
      toast.success("Idea ID copied");
    } catch {
      toast.error("Unable to copy ID");
    }
  }, [idea.id]);

  const handleCopyGithub = useCallback(async () => {
    if (!syncedIdea.githubUrl) {
      toast.error("No repository link to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(syncedIdea.githubUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  }, [syncedIdea.githubUrl]);

  const handleStarToggle = useCallback(() => {
    startStarTransition(async () => {
      try {
        const result = await cycleIdeaStarAction(idea.id);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        const updated = result.idea;
        setSyncedIdea((previous) => ({
          ...previous,
          githubUrl: updated.githubUrl ?? previous.githubUrl,
          linkLabel: updated.linkLabel ?? previous.linkLabel,
          updatedAt: updated.updatedAt,
          starred: updated.starred,
          superStarred: updated.superStarred,
          visibility: updated.visibility,
        }));
        if (!isEditing) {
          setTitle((prev) => (prev === updated.title ? prev : updated.title));
          setNotes((prev) => (prev === updated.notes ? prev : updated.notes));
        }
        if (!isEditingGithub) {
          const nextGithub = updated.githubUrl ?? "";
          const nextLabel = updated.linkLabel ?? "GitHub Repository";
          setGithubDraft((prev) => (prev === nextGithub ? prev : nextGithub));
          setLinkLabelDraft((prev) => (prev === nextLabel ? prev : nextLabel));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update star status");
      }
    });
  }, [idea.id, isEditing, isEditingGithub, startStarTransition]);

  const saveIdea = useCallback(
    async (fields: {
      title?: string;
      notes?: string;
      githubUrl?: string | null;
      linkLabel?: string | null;
      visibility?: "private" | "public";
    }) => {
      ideaSaveInFlight.current = true;
      try {
        const updated = await updateIdeaAction({
          id: idea.id,
          updatedAt: syncedIdea.updatedAt,
          ...fields,
        });
        const nextGithub = updated.githubUrl ?? "";
        const nextLinkLabel = updated.linkLabel ?? "GitHub Repository";
        const nextVisibility = updated.visibility;
        setSyncedIdea({
          title: updated.title,
          notes: updated.notes,
          githubUrl: nextGithub,
          linkLabel: nextLinkLabel,
          updatedAt: updated.updatedAt,
          starred: updated.starred,
          superStarred: updated.superStarred,
          visibility: nextVisibility,
        });
        setTitle((previous) => (previous === updated.title ? previous : updated.title));
        setNotes((previous) => (previous === updated.notes ? previous : updated.notes));
        setGithubDraft((previous) => (previous === nextGithub ? previous : nextGithub));
        setLinkLabelDraft((previous) => (previous === nextLinkLabel ? previous : nextLinkLabel));
        return updated;
      } finally {
        ideaSaveInFlight.current = false;
      }
    },
    [idea.id, syncedIdea.updatedAt],
  );

  const handleVisibilityChange = useCallback(
    async (nextVisibility: "private" | "public") => {
      await saveIdea({ visibility: nextVisibility });
    },
    [saveIdea],
  );

  useEffect(() => {
    if (!isEditing) {
      if (ideaAutoTimer.current) {
        window.clearTimeout(ideaAutoTimer.current);
        ideaAutoTimer.current = null;
      }
      return;
    }

    if (!ideaDirty) {
      if (ideaAutoState === "saving") {
        setIdeaAutoState("saved");
      }
      return;
    }

    if (notesLimitExceeded) {
      return;
    }

    if (ideaAutoTimer.current) {
      window.clearTimeout(ideaAutoTimer.current);
    }

    ideaAutoTimer.current = window.setTimeout(() => {
      if (ideaSaveInFlight.current) {
        return;
      }
      setIdeaAutoState("saving");
      void saveIdea({
        title: title !== syncedIdea.title ? title : undefined,
        notes: notes !== syncedIdea.notes ? notes : undefined,
      })
        .then(() => setIdeaAutoState("saved"))
        .catch((error) => {
          setIdeaAutoState("error");
          toast.error(error instanceof Error ? error.message : "Unable to auto-save idea");
        });
    }, AUTOSAVE_DELAY);

    return () => {
      if (ideaAutoTimer.current) {
        window.clearTimeout(ideaAutoTimer.current);
        ideaAutoTimer.current = null;
      }
    };
  }, [ideaAutoState, ideaDirty, isEditing, notes, notesLimitExceeded, saveIdea, syncedIdea.notes, syncedIdea.title, title]);

  useEffect(() => {
    if (!isEditingGithub) {
      if (githubAutoTimer.current) {
        window.clearTimeout(githubAutoTimer.current);
        githubAutoTimer.current = null;
      }
      return;
    }

    if (!githubDirty) {
      if (githubAutoState === "saving") {
        setGithubAutoState("saved");
      }
      return;
    }

    if (trimmedLinkLabel.length === 0) {
      setGithubAutoState("error");
      return;
    }

    if (githubAutoTimer.current) {
      window.clearTimeout(githubAutoTimer.current);
    }

    githubAutoTimer.current = window.setTimeout(() => {
      if (ideaSaveInFlight.current) {
        return;
      }
      setGithubAutoState("saving");
      if (trimmedLinkLabel.length === 0) {
        setGithubAutoState("error");
        toast.error("Provide a title for the link");
        return;
      }
      void saveIdea({ githubUrl: githubUrlNormalized, linkLabel: trimmedLinkLabel })
        .then(() => setGithubAutoState("saved"))
        .catch((error) => {
          setGithubAutoState("error");
          toast.error(
            error instanceof Error ? error.message : "Unable to auto-save repository link",
          );
        });
    }, AUTOSAVE_DELAY);

    return () => {
      if (githubAutoTimer.current) {
        window.clearTimeout(githubAutoTimer.current);
        githubAutoTimer.current = null;
      }
    };
  }, [githubAutoState, githubDirty, githubUrlNormalized, isEditingGithub, saveIdea, trimmedLinkLabel]);

  const starState = useMemo(() => {
    if (syncedIdea.superStarred) {
      return "super";
    }
    if (syncedIdea.starred) {
      return "star";
    }
    return "none";
  }, [syncedIdea.starred, syncedIdea.superStarred]);

  const starLabel =
    starState === "super"
      ? "Remove super star"
      : starState === "star"
        ? "Promote to super star"
        : "Star idea";

  const deletePrompt = useMemo(() => `Enter "${syncedIdea.title}" to delete`, [syncedIdea.title]);
  const deleteTitleMatches = deleteInput.trim() === syncedIdea.title;
  const totalFeatures = features.length;
  const totalDeletedFeatures = deletedFeaturesState.length;
  const completedFeaturesCount = useMemo(() => features.filter((item) => item.completed).length, [features]);
  const starredFeaturesCount = useMemo(() => features.filter((item) => item.starred).length, [features]);
  const unstarredFeaturesCount = useMemo(
    () => totalFeatures - starredFeaturesCount,
    [starredFeaturesCount, totalFeatures],
  );
  const filterCounts = useMemo<Record<"all" | "completed" | "starred" | "unstarred", number>>(
    () => ({
      all: totalFeatures,
      completed: completedFeaturesCount,
      starred: starredFeaturesCount,
      unstarred: unstarredFeaturesCount,
    }),
    [completedFeaturesCount, starredFeaturesCount, totalFeatures, unstarredFeaturesCount],
  );
  const selectedConvertOption = useMemo(
    () => convertOptions.find((option) => option.id === selectedConvertId) ?? null,
    [convertOptions, selectedConvertId],
  );
  const visibleFeatures = useMemo(() => {
    const normalizedQuery = featureQuery.trim().toLowerCase();
    const normalizedFilter = featureFilter;
    const sorted = [...features];

    sorted.sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }
      const starCompare = Number(b.starred) - Number(a.starred);
      if (starCompare !== 0) {
        return starCompare;
      }

      switch (featureSort) {
        case "updated_desc":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "title_asc":
          return a.title.localeCompare(b.title);
        default:
          return (a.position ?? 0) - (b.position ?? 0);
      }
    });

    return sorted.filter((item) => {
      if (normalizedFilter === "completed" && !item.completed) {
        return false;
      }
      if (normalizedFilter === "starred" && !item.starred) {
        return false;
      }
      if (normalizedFilter === "unstarred" && item.starred) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${item.title} ${item.notes}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [featureFilter, featureQuery, featureSort, features]);

  const canReorderFeatures =
    canWrite &&
    featureView === "active" &&
    featureFilter === "all" &&
    featureQuery.trim().length === 0 &&
    featureSort === "priority";

  const resetDeleteConfirmation = useCallback(() => {
    setIsConfirmingDelete(false);
    setDeleteInput("");
  }, []);

  const exitEditingState = useCallback(() => {
    setTitle(syncedIdea.title);
    setNotes(syncedIdea.notes);
    setGithubDraft(syncedIdea.githubUrl);
    setIsEditing(false);
    setIdeaAutoState("idle");
  }, [syncedIdea.githubUrl, syncedIdea.notes, syncedIdea.title]);

  const handleUpdate = () => {
    if (!canWrite) {
      return;
    }
    if (notesLimitExceeded) {
      toast.error(`Keep the elevator pitch under ${IDEA_NOTES_CHARACTER_LIMIT} characters.`);
      return;
    }
    if (!ideaDirty) {
      setIsEditing(false);
      return;
    }
    setIdeaAutoState("saving");
    void saveIdea({
      title: title !== syncedIdea.title ? title : undefined,
      notes: notes !== syncedIdea.notes ? notes : undefined,
    })
      .then(() => {
        setIdeaAutoState("saved");
        setIsEditing(false);
      })
      .catch((err) => {
        setIdeaAutoState("error");
        toast.error(err instanceof Error ? err.message : "Unable to update idea");
      });
  };

  const handleGithubSave = () => {
    if (!canWrite) {
      return;
    }
    if (!githubDirty) {
      setIsEditingGithub(false);
      return;
    }
    if (trimmedLinkLabel.length === 0) {
      toast.error("Provide a title for the link");
      return;
    }
    setGithubAutoState("saving");
    void saveIdea({ githubUrl: githubUrlNormalized, linkLabel: trimmedLinkLabel })
      .then(() => {
        setGithubAutoState("saved");
        setIsEditingGithub(false);
      })
      .catch((err) => {
        setGithubAutoState("error");
        toast.error(err instanceof Error ? err.message : "Unable to update repository link");
      });
  };

  const beginEditing = useCallback(() => {
    if (!canWrite) {
      return;
    }
    if (isEditing) {
      return;
    }
    resetDeleteConfirmation();
    setIdeaAutoState("idle");
    setGithubDraft(syncedIdea.githubUrl);
    setLinkLabelDraft(syncedIdea.linkLabel);
    setGithubAutoState("idle");
    setIsEditingGithub(true);
    setIsEditing(true);
  }, [
    canWrite,
    isEditing,
    resetDeleteConfirmation,
    setGithubAutoState,
    setIsEditingGithub,
    setGithubDraft,
    setLinkLabelDraft,
    syncedIdea.githubUrl,
    syncedIdea.linkLabel,
  ]);

  const handleToggleConvert = () => {
    if (!canWrite) {
      return;
    }
    setConvertError(null);
    setIsConvertOpen((previous) => !previous);
    setIsActionsOpen(false);
  };

  const handleExportIdea = () => {
    if (!canWrite) {
      return;
    }
    setIsActionsOpen(false);
    startExportTransition(async () => {
      try {
        const data = await exportIdeaAsJsonAction(idea.id);
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = buildIdeaExportFilename(idea.title, idea.id);
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success("Idea exported");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to export idea");
      }
    });
  };

  const handleJoinSubmit = useCallback(() => {
    if (!canRequestToJoin) {
      return;
    }
    if (joinMessageTrimmed.length < 20) {
      toast.error("Share a little more detail so the team knows how you can help.");
      return;
    }
    if (joinMessageTrimmed.length > 1000) {
      toast.error("Keep your note under 1000 characters.");
      return;
    }
    startJoinRequestTransition(async () => {
      try {
        const result = await submitJoinRequestAction({ ideaId: idea.id, message: joinMessageTrimmed });
        if (result.success) {
          setJoinRequest(result.request);
          setJoinMessage("");
          setIsJoinOpen(false);
          toast.success("Request sent! The team will get back to you soon.");
        } else {
          if (result.request) {
            setJoinRequest(result.request);
          }
          if (result.code === "request-exists") {
            toast.error("You already have a pending request.");
            setIsJoinOpen(false);
          } else if (result.code === "already-on-team") {
            toast.error("You’re already on this idea.");
          } else if (result.code === "not-public") {
            toast.error("This idea is no longer open to the public.");
          } else {
            toast.error(result.error);
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to send your request right now.");
      }
    });
  }, [canRequestToJoin, idea.id, joinMessageTrimmed, startJoinRequestTransition]);

  const handleJoinCancel = useCallback(() => {
    setIsJoinOpen(false);
    setJoinMessage("");
  }, []);

  useEffect(() => {
    setJoinRequestCounts(ownerJoinRequestCounts);
    setOwnerJoinRequests(null);
    setIsJoinQueueOpen(false);
    setNoteDrafts({});
    setRoleDrafts({});
    setResolvingRequestId(null);
    setResolvingAction(null);
  }, [idea.id, ownerJoinRequestCounts]);

  useEffect(() => {
    if (!canManageCollaborators) {
      return;
    }
    if (!ownerJoinRequestCounts || ownerJoinRequestCounts.unseen === 0) {
      return;
    }
    toast.info(
      ownerJoinRequestCounts.unseen === 1
        ? "You have 1 new join request waiting."
        : `You have ${ownerJoinRequestCounts.unseen} new join requests waiting.`,
      { id: `join-requests-${idea.id}` },
    );
  }, [canManageCollaborators, idea.id, ownerJoinRequestCounts]);

  useEffect(() => {
    ownerJoinRequestsRef.current = ownerJoinRequests;
  }, [ownerJoinRequests]);

  const loadJoinRequests = useCallback(
    (force = false) => {
      if (!canManageCollaborators) {
        return;
      }
      if (!force && (ownerJoinRequestsRef.current !== null || isLoadingJoinRequests)) {
        return;
      }
      if (force) {
        setOwnerJoinRequests(null);
      }
      startLoadJoinRequests(async () => {
        try {
          const result = await listJoinRequestsAction(idea.id);
          let requests = result.requests;
          let counts = result.counts;
          const unseenIds = requests.filter((request) => !request.ownerSeenAt).map((request) => request.id);
          if (unseenIds.length > 0) {
            try {
              const updatedCounts = await markJoinRequestsSeenAction({ ideaId: idea.id, requestIds: unseenIds });
              counts = updatedCounts;
              const seenStamp = new Date().toISOString();
              requests = requests.map((request) =>
                unseenIds.includes(request.id)
                  ? { ...request, ownerSeenAt: request.ownerSeenAt ?? seenStamp }
                  : request,
              );
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to mark requests as seen.");
            }
          }
          setOwnerJoinRequests(requests);
          setJoinRequestCounts(counts);
          setRoleDrafts((previous) => {
            const next = { ...previous };
            requests
              .filter((request) => request.status === "pending")
              .forEach((request) => {
                if (!(request.id in next)) {
                  next[request.id] = "editor";
                }
              });
            return next;
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to load join requests.");
        }
      });
    },
    [canManageCollaborators, idea.id, isLoadingJoinRequests, startLoadJoinRequests],
  );

  useEffect(() => {
    if (!isJoinQueueOpen) {
      return;
    }
    setIsShareOpen(false);
    loadJoinRequests(false);
  }, [isJoinQueueOpen, loadJoinRequests]);

  const handleToggleJoinQueue = useCallback(() => {
    setIsJoinQueueOpen((previous) => !previous);
  }, []);

  const handleRefreshJoinRequests = useCallback(() => {
    loadJoinRequests(true);
  }, [loadJoinRequests]);

  const handleNoteChange = useCallback((requestId: string, value: string) => {
    setNoteDrafts((previous) => ({ ...previous, [requestId]: value }));
  }, []);

  const handleRoleDraftChange = useCallback((requestId: string, role: "editor" | "commenter" | "viewer") => {
    setRoleDrafts((previous) => ({ ...previous, [requestId]: role }));
  }, []);

  const handleResolveJoinRequest = useCallback(
    (requestId: string, status: "approved" | "rejected") => {
      if (!canManageCollaborators) {
        return;
      }
      const note = (noteDrafts[requestId] ?? "").trim();
      const grantRole = status === "approved" ? roleDrafts[requestId] ?? "editor" : undefined;

      setResolvingRequestId(requestId);
      setResolvingAction(status === "approved" ? "approve" : "reject");
      startResolveJoinRequest(async () => {
        try {
          const result = await resolveJoinRequestAction({
            requestId,
            status,
            note: note.length > 0 ? note : null,
            grantRole,
          });
          setOwnerJoinRequests((previous) => {
            if (!previous) {
              return previous;
            }
            return previous.map((request) => (request.id === requestId ? result.request : request));
          });
          setJoinRequestCounts(result.counts);
          if (status === "approved") {
            toast.success("Request approved—access granted.");
          } else {
            toast.success("Request declined.");
          }
          setNoteDrafts((previous) => {
            if (!(requestId in previous)) {
              return previous;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [requestId]: _removed, ...rest } = previous;
            return rest;
          });
          setRoleDrafts((previous) => {
            if (!(requestId in previous)) {
              return previous;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [requestId]: _removed, ...rest } = previous;
            return rest;
          });
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to update request.");
        } finally {
          setResolvingRequestId(null);
          setResolvingAction(null);
        }
      });
    },
    [canManageCollaborators, noteDrafts, roleDrafts, router, startResolveJoinRequest],
  );

  const handleArchiveJoinRequest = useCallback(
    (requestId: string) => {
      if (!canManageCollaborators) {
        return;
      }
      setResolvingRequestId(requestId);
      setResolvingAction("archive");
      startResolveJoinRequest(async () => {
        try {
          const result = await archiveJoinRequestAction(requestId);
          setOwnerJoinRequests((previous) => (previous ? previous.filter((request) => request.id !== requestId) : previous));
          setJoinRequestCounts(result.counts);
          setNoteDrafts((previous) => {
            if (!(requestId in previous)) {
              return previous;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [requestId]: _removed, ...rest } = previous;
            return rest;
          });
          setRoleDrafts((previous) => {
            if (!(requestId in previous)) {
              return previous;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [requestId]: _removed, ...rest } = previous;
            return rest;
          });
          toast.success("Request archived.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to archive request.");
        } finally {
          setResolvingRequestId(null);
          setResolvingAction(null);
        }
      });
    },
    [canManageCollaborators, startResolveJoinRequest],
  );
  useEffect(() => {
    if (!isConvertOpen) {
      setSelectedConvertId("");
      setIsConvertDropdownOpen(false);
      return;
    }

    if (convertOptions.length > 0) {
      setSelectedConvertId((value) => value || (convertOptions[0]?.id ?? ""));
      return;
    }

    startLoadConvertOptions(async () => {
      try {
        const options = await listIdeaOptionsAction(idea.id);
        setConvertOptions(options);
        setSelectedConvertId(options[0]?.id ?? "");
        if (options.length === 0) {
          setConvertError("Create another idea first to convert into a feature.");
        }
      } catch (error) {
        setConvertError(error instanceof Error ? error.message : "Unable to load ideas");
      }
    });
  }, [convertOptions, idea.id, isConvertOpen, startLoadConvertOptions]);

  useEffect(() => {
    if (!isConvertDropdownOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!convertDropdownRef.current?.contains(event.target as Node)) {
        setIsConvertDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isConvertDropdownOpen]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isEditing]);

  const handleConvert = () => {
    if (!canWrite) {
      return;
    }
    if (!selectedConvertId) {
      setConvertError("Choose a destination idea.");
      return;
    }
    setConvertError(null);
    startConvertTransition(async () => {
      try {
        await convertIdeaToFeatureAction({
          sourceIdeaId: idea.id,
          targetIdeaId: selectedConvertId,
        });
        toast.success("Idea converted to feature");
        setIsConvertOpen(false);
        router.push(`/dashboard/ideas/${selectedConvertId}`);
        router.refresh();
      } catch (error) {
        setConvertError(error instanceof Error ? error.message : "Unable to convert idea");
      }
    });
  };

  const handleDelete = () => {
    setIsActionsOpen(false);
    setIsConfirmingDelete(true);
    setDeleteInput("");
  };

  const confirmDelete = useCallback(() => {
    if (isPending) {
      return;
    }
    if (deleteInput.trim() !== syncedIdea.title) {
      toast.error("Title didn't match. Idea not deleted.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await deleteIdeaAction({ id: idea.id });
        showUndoToast({
          message: "Idea deleted",
          expiresAt: result.expiresAt,
          onUndo: async () => {
            await restoreIdeaAction({ id: idea.id, token: result.undoToken });
            toast.success("Idea restored");
          },
        });
        router.push("/dashboard/ideas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete idea");
      }
    });
  }, [deleteInput, idea.id, isPending, router, startTransition, syncedIdea.title]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();

      if (isConfirmingDelete) {
        resetDeleteConfirmation();
        blurActiveElement();
        return;
      }

      if (isEditingGithub) {
        setGithubDraft(syncedIdea.githubUrl);
        setIsEditingGithub(false);
        setGithubAutoState("idle");
        blurActiveElement();
        return;
      }

      if (isEditing) {
        exitEditingState();
        blurActiveElement();
        return;
      }

      const activeComposer = document.querySelector('[data-testid="feature-composer-expanded"]');
      if (activeComposer) {
        window.dispatchEvent(new CustomEvent("coda:feature-composer:close", { detail: { ideaId: idea.id } }));
        blurActiveElement();
        return;
      }

      const convertEditing = Array.from(document.querySelectorAll('[data-testid="feature-card"]')).some((card) =>
        card.contains(document.activeElement)
      );

      if (convertEditing) {
        return;
      }

      blurActiveElement();
      router.push("/dashboard/ideas");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    blurActiveElement,
    exitEditingState,
    idea.id,
    isConfirmingDelete,
    isEditing,
    isEditingGithub,
    resetDeleteConfirmation,
    router,
    syncedIdea.githubUrl,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="interactive-btn cursor-pointer hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-0"
          onClick={() => router.push("/dashboard/ideas")}
        >
          <ArrowLeft className="mr-2 size-4" /> Back to ideas
        </Button>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-4" /> Created {createdAt}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> Updated {updatedAt}
          </span>
        </div>
      </div>

      <Card data-testid="idea-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-2xl font-semibold text-foreground">
                {syncedIdea.title}
              </CardTitle>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                  syncedIdea.visibility === "public"
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-600 bg-slate-900 text-slate-200",
                )}
              >
                {syncedIdea.visibility === "public" ? (
                  <>
                    <Globe2 className="size-3" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="size-3" /> Private
                  </>
                )}
              </span>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                onClick={() => setIsIdVisible((previous) => !previous)}
                data-testid="idea-id-toggle"
              >
                {isIdVisible ? "Hide ID" : "Show ID"}
              </button>
            </div>
            <AnimatePresence initial={false} mode="wait">
              {isIdVisible ? (
                <motion.div
                  key="idea-id"
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs tracking-widest text-muted-foreground">{maskedId}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="interactive-btn h-7 w-7 cursor-pointer hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                    onClick={handleCopyId}
                    aria-label="Copy idea ID"
                    data-testid="idea-id-copy"
                  >
                    <Copy className="size-4" />
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {collaboratorAvatars.length > 0 ? (
              <div className="flex items-center gap-1 pr-2">
                {visibleAvatars.map((member) => (
                  <span
                    key={member.id}
                    title={`${member.name}${member.status === "editing" ? " • editing" : ""}`}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground",
                      member.status === "editing" && "ring-2 ring-primary/70 ring-offset-1 ring-offset-background",
                    )}
                  >
                    {member.initials}
                  </span>
                ))}
                {extraCollaborators > 0 ? (
                  <span className="text-xs text-muted-foreground">+{extraCollaborators}</span>
                ) : null}
              </div>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "interactive-btn text-muted-foreground hover:text-foreground",
                  starState === "star" && "text-yellow-400 hover:text-yellow-300",
                  starState === "super" && "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] hover:text-amber-200",
                )}
                onClick={handleStarToggle}
                aria-label={starLabel}
                data-testid="idea-star-toggle"
                disabled={isStarPending}
              >
                {starState === "super" ? (
                  <span className="relative inline-flex items-center justify-center">
                    <Star className="size-4 fill-current" />
                    <Sparkles className="absolute -top-2 -right-2 size-3 text-amber-200" aria-hidden="true" />
                  </span>
                ) : starState === "star" ? (
                  <Star className="size-4 fill-current" />
                ) : (
                  <StarOff className="size-4" />
                )}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                variant={isEditing ? "secondary" : "ghost"}
                size="icon-sm"
                className="interactive-btn text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (isEditing) {
                    exitEditingState();
                    resetDeleteConfirmation();
                    return;
                  }
                  beginEditing();
                }}
                aria-label={isEditing ? "Cancel editing" : "Edit idea"}
                data-testid="idea-edit-toggle"
              >
                {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
              </Button>
            ) : null}
            {canManageCollaborators ? (
              <>
                <Button
                  type="button"
                  variant={isJoinQueueOpen ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "interactive-btn flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-transparent",
                    isJoinQueueOpen && "bg-muted/30",
                  )}
                  onClick={handleToggleJoinQueue}
                  aria-expanded={isJoinQueueOpen}
                  data-testid="idea-join-requests-button"
                >
                  <Users className="size-4" />
                  Requests
                  {showJoinQueueIndicator ? (
                    <span
                      className={cn(
                        "ml-1 inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-50 shadow-sm",
                        joinQueueUnseen > 0 && "animate-pulse",
                      )}
                    >
                      {joinQueueUnseen > 0 ? `${joinQueueUnseen} new` : joinQueuePending}
                    </span>
                  ) : null}
                  {isLoadingJoinRequests && ownerJoinRequests === null ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant={isShareOpen ? "secondary" : "outline"}
                  size="sm"
                  className="interactive-btn flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-transparent"
                  onClick={() => {
                    setIsShareOpen((previous) => !previous);
                    setIsActionsOpen(false);
                    setIsJoinQueueOpen(false);
                  }}
                  aria-expanded={isShareOpen}
                  data-testid="idea-share-button"
                >
                  <Share2 className="size-4" />
                  Share
                  {showShareIndicator ? (
                    <span className="ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                      {pendingInvites}
                    </span>
                  ) : null}
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <>
                <DropdownMenu
                  open={isActionsOpen}
                  onOpenChange={(open) => {
                    setIsActionsOpen(open);
                    if (!open) {
                      setIsDevModeExpanded(false);
                    }
                  }}
                  modal
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "interactive-btn flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-transparent",
                        isActionsOpen && "bg-muted/30",
                      )}
                      aria-haspopup="menu"
                      aria-expanded={isActionsOpen}
                      data-testid="idea-actions-button"
                    >
                      Actions
                      {isOnline !== null ? (
                        <span
                          className={cn(
                            "ml-1 inline-block h-2 w-2 rounded-full",
                            isOnline ? "bg-green-500" : "bg-gray-400",
                          )}
                          aria-label={isOnline ? "Runner online" : "Runner offline"}
                        />
                      ) : null}
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform text-muted-foreground",
                          isActionsOpen ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="z-[70] border-border/60 bg-card text-sm text-muted-foreground shadow-xl w-[calc(100vw-2.5rem)] max-w-sm sm:w-56"
                  >
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleExportIdea();
                      }}
                      disabled={isExporting}
                      className="flex items-center justify-between"
                      data-testid="idea-export-button"
                    >
                      <span>Export idea</span>
                      {isExporting ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleToggleConvert();
                      }}
                      disabled={isConverting}
                      className="flex items-center justify-between"
                      data-testid="idea-convert-toggle"
                    >
                      <span>{isConvertOpen ? "Close convert panel" : "Convert to feature"}</span>
                      {isConverting ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsDevModeExpanded((previous) => !previous);
                      }}
                      className="flex items-center justify-between"
                      aria-expanded={isDevModeExpanded}
                      data-testid="idea-devmode-disclosure"
                    >
                      <span>Dev Mode</span>
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform text-muted-foreground",
                          isDevModeExpanded ? "rotate-180 text-foreground" : "rotate-0",
                        )}
                        aria-hidden="true"
                      />
                    </DropdownMenuItem>
                    {isDevModeExpanded ? (
                      <>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setShowDevMode((value) => !value);
                            setIsActionsOpen(false);
                          }}
                          className="pl-8 text-xs text-muted-foreground"
                          data-testid="idea-devmode-toggle"
                        >
                          {showDevMode ? "Hide Dev Mode panel" : "Show Dev Mode panel"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            try {
                              router.push("/dashboard/devmode/pair");
                            } catch {}
                            setIsActionsOpen(false);
                          }}
                          className="pl-8 text-xs text-muted-foreground"
                          data-testid="idea-devmode-pair"
                        >
                          Enable Dev Mode (Pair Runner)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            try {
                              router.push("/dashboard/devmode/devices");
                            } catch {}
                            setIsActionsOpen(false);
                          }}
                          className="pl-8 text-xs text-muted-foreground"
                          data-testid="idea-devmode-devices"
                        >
                          Manage Paired Devices
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDelete();
                      }}
                      disabled={isPending}
                      className="flex items-center justify-between text-destructive focus:text-destructive"
                      data-testid="idea-delete-button"
                    >
                      <span>Delete idea</span>
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isActionsOpen ? (
                  <div
                    className="fixed inset-0 z-[60] cursor-pointer bg-transparent"
                    onClick={() => setIsActionsOpen(false)}
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {isConfirmingDelete ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Input
                  value={deleteInput}
                  onChange={(event) => setDeleteInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmDelete();
                    }
                  }}
                  placeholder={deletePrompt}
                  aria-label={deletePrompt}
                  data-testid="idea-detail-delete-inline-input"
                  className="h-10 w-full pr-10 placeholder:text-muted-foreground/50"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-btn absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                  onClick={resetDeleteConfirmation}
                  aria-label="Cancel delete"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="interactive-btn px-3 py-1.5 text-xs font-semibold"
                onClick={confirmDelete}
                disabled={isPending || !deleteTitleMatches}
                data-testid="idea-delete-confirm"
              >
                Delete
              </Button>
            </div>
          ) : null}
          {canManageCollaborators && isJoinQueueOpen ? (
            <div className="rounded-lg border border-border/70 bg-card/70 p-4" data-testid="idea-join-requests-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Join requests</h3>
                  <p className="text-sm text-muted-foreground">
                    Review applications from the community and decide who can collaborate.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 font-semibold">
                    {joinQueuePending === 0 ? "No pending requests" : `${joinQueuePending} pending`}
                    {joinQueueUnseen > 0 ? <span className="ml-1 text-amber-200">({joinQueueUnseen} new)</span> : null}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="interactive-btn"
                    onClick={handleRefreshJoinRequests}
                    disabled={isLoadingJoinRequests}
                  >
                    {isLoadingJoinRequests ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="interactive-btn"
                    onClick={() => setIsJoinQueueOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <Separator className="my-4" />
              {isLoadingJoinRequests && ownerJoinRequests === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading join requests…
                </div>
              ) : null}
              {ownerJoinRequests && ownerJoinRequests.length === 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                  No requests yet. Once someone asks to collaborate, they’ll appear here.
                </div>
              ) : null}
              {ownerJoinRequests && ownerJoinRequests.length > 0 ? (
                <div className="space-y-4">
                  {ownerJoinRequests.map((request) => {
                    const status = request.status;
                    const applicantName = request.applicant?.name?.trim() || "Unknown collaborator";
                    const applicantEmail = request.applicant?.email?.trim() || null;
                    const statusLabel = status === "pending" ? "Pending" : status === "approved" ? "Approved" : "Declined";
                    const statusStyle =
                      status === "pending"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        : status === "approved"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/40 bg-rose-500/10 text-rose-200";
                    const noteValue = noteDrafts[request.id] ?? "";
                    const roleValue = roleDrafts[request.id] ?? "editor";
                    const isProcessing = isResolvingJoinRequest && resolvingRequestId === request.id;
                    return (
                      <div key={request.id} className="rounded-md border border-border/60 bg-muted/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{applicantName}</span>
                              {applicantEmail ? (
                                <a
                                  href={`mailto:${applicantEmail}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {applicantEmail}
                                </a>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Requested {formatDateTime(request.createdAt)}
                            </p>
                          </div>
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", statusStyle)}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="mt-3 rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{request.message}</pre>
                        </div>
                        {status === "pending" ? (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Grant role
                              </label>
                              <select
                                value={roleValue}
                                onChange={(event) => handleRoleDraftChange(request.id, event.target.value as "editor" | "commenter" | "viewer")}
                                className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs font-medium text-foreground shadow-sm"
                              >
                                <option value="editor">Editor</option>
                                <option value="commenter">Commenter</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`join-request-note-${request.id}`}>
                                Note to applicant (optional)
                              </label>
                              <Textarea
                                id={`join-request-note-${request.id}`}
                                value={noteValue}
                                onChange={(event) => handleNoteChange(request.id, event.target.value)}
                                rows={2}
                                maxLength={1000}
                                className="resize-none border-border/60 bg-background/80"
                                placeholder="Share any context about the approval or next steps."
                              />
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{noteValue.trim().length}/1000</span>
                                <span>Applicants see this note in their confirmation email.</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="interactive-btn"
                                onClick={() => handleResolveJoinRequest(request.id, "approved")}
                                disabled={isProcessing}
                              >
                                {isProcessing && resolvingAction === "approve" ? (
                                  <Loader2 className="mr-1 size-4 animate-spin" />
                                ) : null}
                                Approve &amp; add collaborator
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="interactive-btn"
                                onClick={() => handleResolveJoinRequest(request.id, "rejected")}
                                disabled={isProcessing}
                              >
                                {isProcessing && resolvingAction === "reject" ? (
                                  <Loader2 className="mr-1 size-4 animate-spin" />
                                ) : null}
                                Decline
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            {request.resolutionNote ? (
                              <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Resolution note</span>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{request.resolutionNote}</p>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span>Processed {request.processedAt ? formatDateTime(request.processedAt) : "just now"}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="interactive-btn"
                                onClick={() => handleArchiveJoinRequest(request.id)}
                                disabled={isProcessing}
                              >
                                {isProcessing && resolvingAction === "archive" ? (
                                  <Loader2 className="mr-1 size-3 animate-spin" />
                                ) : null}
                                Archive
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 space-y-6">
          {canRequestToJoin ? (
            <div className="rounded-xl border border-border/60 bg-gradient-to-br from-background/70 via-background/60 to-background/30 p-4 shadow-inner">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Ready to join forces?</h3>
                    <p className="text-xs text-muted-foreground">
                      Introduce yourself and request edit access from the idea’s owner.
                    </p>
                  </div>
                  {!hasPendingJoinRequest && !hasApprovedJoinRequest && !isJoinOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "join-forces-button interactive-btn relative overflow-hidden px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em]",
                        "text-slate-50",
                      )}
                      onClick={() => setIsJoinOpen(true)}
                    >
                      <span className="join-forces-glow" aria-hidden="true" />
                      <Sparkles
                        aria-hidden="true"
                        className="size-4 text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                      />
                      Join Forces
                      <Sparkles
                        aria-hidden="true"
                        className="size-4 text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                      />
                    </Button>
                  ) : null}
                </div>
                {hasApprovedJoinRequest ? (
                  <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2">
                    <p className="text-sm font-medium text-emerald-100">You’re already on the shortlist.</p>
                    <p className="text-xs text-emerald-100/80">
                      Keep an eye on your inbox—an invite is on the way.
                    </p>
                  </div>
                ) : hasPendingJoinRequest ? (
                  <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2">
                    <p className="text-sm font-medium text-emerald-100">Request sent</p>
                    <p className="text-xs text-emerald-100/80">
                      The idea owner will reach out once they review your note.
                    </p>
                  </div>
                ) : (
                  <>
                    {joinRequestStatus === "rejected" ? (
                      <p className="text-xs text-amber-200">
                        This team hasn’t accepted your last request. Update your pitch and try again.
                      </p>
                    ) : null}
                    {isJoinOpen ? (
                      <div className="space-y-3">
                        <Textarea
                          value={joinMessage}
                          onChange={(event) => setJoinMessage(event.target.value)}
                          placeholder="Share how you can help bring this idea to life…"
                          rows={4}
                          className="resize-none border-border/60 bg-background/80"
                          maxLength={1000}
                          data-testid="join-forces-message"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{joinMessageLength}/1000 characters</span>
                          {joinMessageTooShort ? (
                            <span className="text-amber-300">Add a bit more detail to help the team evaluate.</span>
                          ) : null}
                          {joinMessageTooLong ? (
                            <span className="text-destructive">Trim your note to stay under 1000 characters.</span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={handleJoinSubmit}
                            disabled={
                              isJoinSubmitting ||
                              joinMessageTrimmed.length === 0 ||
                              joinMessageTooShort ||
                              joinMessageTooLong
                            }
                          >
                            {isJoinSubmitting ? "Sending…" : "Send request"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={handleJoinCancel}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Tell the team how you can help and they’ll review your request to collaborate.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
          {canManageCollaborators ? (
            <IdeaSharePanel
              ideaId={idea.id}
              open={isShareOpen}
              canManage={canManageCollaborators}
              visibility={syncedIdea.visibility}
              onClose={() => setIsShareOpen(false)}
              onVisibilityChange={handleVisibilityChange}
              onUsageRefresh={() => router.refresh()}
              onInviteCountChange={setPendingInvites}
            />
          ) : null}
          {canWrite && isConvertOpen ? (
            <div className="rounded-lg border border-border/70 bg-card/70 p-4" data-testid="idea-convert-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="convert-target">
                    Destination idea
                  </label>
                  {isLoadingConvertOptions ? (
                    <p className="text-xs text-muted-foreground">Loading ideas…</p>
                  ) : convertOptions.length > 0 ? (
                    <div className="relative" ref={convertDropdownRef}>
                      <button
                        type="button"
                        className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-4 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setIsConvertDropdownOpen((previous) => !previous)}
                        data-testid="convert-target-trigger"
                      >
                        <span className="truncate">
                          {selectedConvertOption?.title ?? "Select destination idea"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform text-muted-foreground",
                            isConvertDropdownOpen ? "rotate-180" : "rotate-0",
                          )}
                        />
                      </button>
                      {isConvertDropdownOpen ? (
                        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-border/60 bg-card shadow-xl">
                          <ul className="max-h-64 overflow-y-auto py-1" data-testid="convert-target-dropdown">
                            {convertOptions.map((option) => {
                              const isActive = option.id === selectedConvertId;
                              return (
                                <li key={option.id}>
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm transition-colors",
                                      isActive
                                        ? "bg-muted/60 text-foreground"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                                    )}
                                    onClick={() => {
                                      setSelectedConvertId(option.id);
                                      setIsConvertDropdownOpen(false);
                                    }}
                                  >
                                    <span className="truncate">{option.title}</span>
                                    {isActive ? <Check className="size-3" /> : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground/80">Choose where this feature will live.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {convertError ?? "Create another idea to convert into a feature."}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleConvert}
                    disabled={
                      isConverting ||
                      isLoadingConvertOptions ||
                      convertOptions.length === 0 ||
                      !selectedConvertId
                    }
                    data-testid="convert-submit"
                  >
                    {isConverting ? "Converting…" : "Convert"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleToggleConvert}
                    className="interactive-btn hover:bg-transparent text-muted-foreground"
                    aria-label="Close convert panel"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              {convertError ? (
                <p className="mt-3 text-xs text-destructive" data-testid="convert-error">
                  {convertError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isEditing ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="idea-title">
                  Title
                </label>
                <Input
                  id="idea-title"
                  ref={titleInputRef}
                  data-testid="idea-edit-title-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handleUpdate();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      exitEditingState();
                      blurActiveElement();
                    }
                  }}
                  placeholder="Idea title"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="idea-notes">
                    Core plan
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {characterCount}/{IDEA_NOTES_CHARACTER_LIMIT} characters
                  </span>
                </div>
                <Textarea
                  id="idea-notes"
                  data-testid="idea-edit-notes-input"
                  rows={8}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handleUpdate();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      exitEditingState();
                      blurActiveElement();
                    }
                  }}
                  maxLength={IDEA_NOTES_CHARACTER_LIMIT}
                />
                {notesLimitExceeded ? (
                  <p className="text-xs text-destructive">
                    Keep this elevator pitch under {IDEA_NOTES_CHARACTER_LIMIT} characters.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={handleUpdate}
                  disabled={ideaAutoState === "saving" || !ideaDirty || notesLimitExceeded}
                >
                  {ideaAutoState === "saving" ? "Saving…" : "Save changes"}
                </Button>
                {ideaAutoState === "saving" ? (
                  <span className="text-xs text-muted-foreground">Saving…</span>
                ) : null}
                {ideaAutoState === "saved" && !ideaDirty ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3" /> Auto-saved
                  </span>
                ) : null}
                {ideaAutoState === "error" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <X className="size-3" /> Save failed
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-2" data-core-plan-preview="">
              <h3 className="text-sm font-medium text-muted-foreground">Core plan</h3>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                {corePlanPreview ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">A core plan is saved for this idea. Tap Edit to view or update it.</p>
                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">Saved</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No core plan captured yet.</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <LinkIcon className="size-4" /> {linkLabelDisplay}
              </div>
            <div className="flex items-center gap-2">
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                  onClick={() => {
                    if (!canWrite) {
                      return;
                    }
                    if (isEditingGithub) {
                      setGithubDraft(syncedIdea.githubUrl);
                      setLinkLabelDraft(syncedIdea.linkLabel);
                      setIsEditingGithub(false);
                      setGithubAutoState("idle");
                      return;
                    }
                    setGithubDraft(syncedIdea.githubUrl);
                    setLinkLabelDraft(syncedIdea.linkLabel);
                    setGithubAutoState("idle");
                    setIsEditingGithub(true);
                  }}
                  aria-label={isEditingGithub ? "Cancel edit" : "Edit repository link"}
                  data-testid="github-edit-button"
                >
                  {isEditingGithub ? <X className="size-4" /> : <Pencil className="size-4" />}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                  className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                  onClick={handleCopyGithub}
                  aria-label="Copy repository link"
                  data-testid="github-copy-button"
                  disabled={!idea.githubUrl}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            {isEditingGithub ? (
              <div className="space-y-3" data-testid="github-editing">
                <Input
                  value={linkLabelDraft}
                  onChange={(event) => setLinkLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handleGithubSave();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setGithubDraft(syncedIdea.githubUrl);
                      setLinkLabelDraft(syncedIdea.linkLabel);
                      setIsEditingGithub(false);
                      setGithubAutoState("idle");
                      blurActiveElement();
                    }
                  }}
                  placeholder="Title of URL"
                  disabled={githubAutoState === "saving"}
                  data-testid="github-title-input"
                />
                <Input
                  value={githubDraft}
                  onChange={(event) => setGithubDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handleGithubSave();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setGithubDraft(syncedIdea.githubUrl);
                      setLinkLabelDraft(syncedIdea.linkLabel);
                      setIsEditingGithub(false);
                      setGithubAutoState("idle");
                      blurActiveElement();
                    }
                  }}
                  placeholder="https://github.com/your-org/your-repo"
                  autoFocus
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGithubDraft(syncedIdea.githubUrl);
                      setLinkLabelDraft(syncedIdea.linkLabel);
                      setIsEditingGithub(false);
                      setGithubAutoState("idle");
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGithubSave}
                      disabled={githubAutoState === "saving" || !githubDirty}
                      className="flex items-center gap-1"
                      data-testid="github-save-button"
                    >
                      {githubAutoState === "saving" ? "Saving…" : <Check className="size-4" />}
                      <span>Save</span>
                    </Button>
                    {githubAutoState === "saving" ? (
                      <span className="text-xs text-muted-foreground">Saving…</span>
                    ) : null}
                    {githubAutoState === "saved" && !githubDirty ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3" /> Auto-saved
                      </span>
                    ) : null}
                    {githubAutoState === "error" ? (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <X className="size-3" /> Save failed
                      </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="interactive-btn cursor-pointer px-3 py-1.5 text-xs font-medium hover:bg-transparent"
              onClick={() =>
                startExportTransition(async () => {
                  try {
                    const data = await exportIdeaAsJsonAction(idea.id);
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = buildIdeaExportFilename(idea.title, idea.id);
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);
                    URL.revokeObjectURL(url);
                    toast.success("Idea exported");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to export idea");
                  }
                })
              }
              disabled={isExporting}
              data-testid="idea-export-button"
            >
            {isExporting ? "Exporting…" : "Export idea"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="interactive-btn cursor-pointer px-3 py-1.5 text-xs font-medium hover:bg-transparent"
              onClick={handleToggleConvert}
              disabled={isConverting}
              data-testid="idea-convert-toggle"
            >
              {isConvertOpen ? "Close convert" : "Convert to feature"}
            </Button>
          </div>
              </div>
            ) : syncedIdea.githubUrl ? (
              <a
                href={syncedIdea.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                data-testid="github-link"
              >
                {syncedIdea.githubUrl}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No repository linked yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {showDevMode ? (
        <IdeaDevPanel ideaId={idea.id} onRequestClose={() => setShowDevMode(false)} />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Features</h2>
            <p className="text-sm text-muted-foreground">
              Break this idea into smaller pieces and capture the details for each feature.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full items-center gap-2 sm:max-w-sm lg:max-w-md">
              <Input
                placeholder="Search features"
                value={featureQuery}
                onChange={(event) => setFeatureQuery(event.target.value)}
                data-testid="feature-search-input"
                className="w-full"
                disabled={featureView === "deleted"}
              />
              {featureQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="interactive-btn hover:bg-muted/30"
                  onClick={() => setFeatureQuery("")}
                  disabled={featureView === "deleted"}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="interactive-btn border-border text-muted-foreground hover:bg-muted/30"
              onClick={() => setShowFilters((previous) => !previous)}
              ref={filterTriggerRef}
              aria-expanded={showFilters}
              aria-label="Filter features"
            >
              <Funnel className="size-4" />
            </Button>
          </div>
        </div>

        {canWrite ? <FeatureComposer ideaId={idea.id} /> : null}

        {showFilters ? (
          <div
            ref={filterPanelRef}
            className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-lg"
            data-testid="feature-filter-panel"
          >
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Feature view">
              <Button
                type="button"
                variant={featureView === "active" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                  featureView === "active" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
                )}
                onClick={() => setFeatureView("active")}
              >
                Active ({totalFeatures})
              </Button>
              <Button
                type="button"
                variant={featureView === "deleted" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase",
                  featureView === "deleted" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
                )}
                onClick={() => setFeatureView("deleted")}
                disabled={totalDeletedFeatures === 0}
              >
                Recently deleted ({totalDeletedFeatures})
              </Button>
            </div>
            {featureView === "active" ? (
              <>
                <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter features">
                  {featureFilterOptions.map((option) => {
                    const isActive = featureFilter === option.value;
                    const count = filterCounts[option.value];
                    const label = count > 0 ? `${option.label} (${count})` : option.label;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        role="tab"
                        aria-selected={isActive}
                        data-state={isActive ? "active" : "inactive"}
                        className={cn(
                          "interactive-btn rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
                          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted/30",
                        )}
                        onClick={() => setFeatureFilter(option.value)}
                        disabled={option.value === "all" ? false : filterCounts[option.value] === 0}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="feature-sort" className="text-xs font-medium text-muted-foreground">
                    Sort by
                  </label>
                  <select
                    id="feature-sort"
                    value={featureSort}
                    onChange={(event) =>
                      setFeatureSort(event.target.value as (typeof featureSortOptions)[number]["value"])
                    }
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="feature-sort-select"
                  >
                    {featureSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a feature to restore it back into the active list.
              </p>
            )}
          </div>
        ) : null}

        {featureView === "active" ? (
          <FeatureList
            ideaId={idea.id}
            features={visibleFeatures}
            emptyLabel={totalFeatures === 0 ? undefined : "No features match your filters."}
            canReorder={canReorderFeatures}
            showCompletedSection={featureFilter !== "completed"}
            canEdit={canWrite}
          />
        ) : (
          <DeletedFeatureList
            features={deletedFeaturesState}
            onRestore={(featureId) => {
              setRestoreTargetId(featureId);
              startRestoreFeatureTransition(async () => {
                try {
                  await restoreDeletedFeatureAction({ id: featureId });
                  setDeletedFeaturesState((previous) => previous.filter((feature) => feature.id !== featureId));
                  toast.success("Feature restored");
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to restore feature");
                } finally {
                  setRestoreTargetId(null);
                }
              });
            }}
            isRestoring={isRestoringFeature}
            restoringId={restoreTargetId}
          />
        )}
      </section>
    </motion.div>
  );
}

function DeletedFeatureList({
  features,
  onRestore,
  isRestoring,
  restoringId,
}: {
  features: Feature[];
  onRestore: (id: string) => void;
  isRestoring: boolean;
  restoringId: string | null;
}) {
  if (features.length === 0) {
    return <p className="text-sm text-muted-foreground">No recently deleted features.</p>;
  }

  return (
    <div className="space-y-3" data-testid="feature-deleted-list">
      {features.map((feature) => {
        const deletedLabel = feature.deletedAt ? formatDateTime(feature.deletedAt) : "Just now";
        const isPending = isRestoring && restoringId === feature.id;
        return (
          <Card
            key={feature.id}
            className="border border-border/60 bg-muted/20"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="truncate text-base font-semibold text-foreground">{feature.title}</CardTitle>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Deleted {deletedLabel}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="interactive-btn cursor-pointer px-3 py-1.5 text-xs font-semibold"
                onClick={() => onRestore(feature.id)}
                disabled={isPending}
                data-testid={`feature-restore-${feature.id}`}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Restore"}
              </Button>
            </CardHeader>
            {feature.notes ? (
              <CardContent className="pt-0">
                <p className="line-clamp-2 text-sm text-muted-foreground">{feature.notes}</p>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
