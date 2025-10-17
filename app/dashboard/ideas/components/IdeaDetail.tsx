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
  Link as LinkIcon,
  Loader2,
  Pencil,
  Sparkles,
  Star,
  StarOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "../actions";
import { FeatureComposer } from "./FeatureComposer";
import { FeatureList } from "./FeatureList";
import { showUndoToast } from "./UndoSnackbar";
import type { Feature, Idea } from "./types";

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

const AUTOSAVE_DELAY = 10_000;

export function IdeaDetail({ idea, features, deletedFeatures }: { idea: Idea; features: Feature[]; deletedFeatures: Feature[] }) {
  const router = useRouter();
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
  const convertDropdownRef = useRef<HTMLDivElement | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [isCoreExpanded, setIsCoreExpanded] = useState(false);
  const [isIdVisible, setIsIdVisible] = useState(false);
  const [deletedFeaturesState, setDeletedFeaturesState] = useState(deletedFeatures);
  const [isRestoringFeature, startRestoreFeatureTransition] = useTransition();
  const [isStarPending, startStarTransition] = useTransition();
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
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
    });
    setLinkLabelDraft(idea.linkLabel ?? "GitHub Repository");
    setIdeaAutoState("idle");
    setGithubAutoState("idle");
    setIsCoreExpanded(false);
    setIsIdVisible(false);
  }, [idea.githubUrl, idea.id, idea.linkLabel, idea.notes, idea.starred, idea.superStarred, idea.title, idea.updatedAt]);

  useEffect(() => {
    setDeletedFeaturesState(deletedFeatures);
  }, [deletedFeatures]);

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
        const updated = await cycleIdeaStarAction(idea.id);
        setSyncedIdea((previous) => ({
          ...previous,
          githubUrl: updated.githubUrl ?? previous.githubUrl,
          linkLabel: updated.linkLabel ?? previous.linkLabel,
          updatedAt: updated.updatedAt,
          starred: updated.starred,
          superStarred: updated.superStarred,
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
    async (fields: { title?: string; notes?: string; githubUrl?: string | null; linkLabel?: string | null }) => {
      ideaSaveInFlight.current = true;
      try {
        const updated = await updateIdeaAction({
          id: idea.id,
          updatedAt: syncedIdea.updatedAt,
          ...fields,
        });
        const nextGithub = updated.githubUrl ?? "";
        const nextLinkLabel = updated.linkLabel ?? "GitHub Repository";
        setSyncedIdea({
          title: updated.title,
          notes: updated.notes,
          githubUrl: nextGithub,
          linkLabel: nextLinkLabel,
          updatedAt: updated.updatedAt,
          starred: updated.starred,
          superStarred: updated.superStarred,
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
    featureView === "active" && featureFilter === "all" && featureQuery.trim().length === 0 && featureSort === "priority";

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
    setConvertError(null);
    setIsConvertOpen((previous) => !previous);
    setIsActionsOpen(false);
  };

  const handleExportIdea = () => {
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
    if (!isActionsOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isActionsOpen]);

useEffect(() => {
  if (!isEditing) {
    setIsCoreExpanded(false);
  }
}, [isEditing]);

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

      if (isCoreExpanded) {
        setIsCoreExpanded(false);
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
    isCoreExpanded,
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

      <Card
        data-testid="idea-card"
        className={cn(!isEditing && "cursor-text")}
        onClick={(event) => {
          // Ignore clicks originating from controls that manage their own behavior.
          const target = event.target as HTMLElement;
          if (target.closest("button, a, input, textarea")) {
            return;
          }
          beginEditing();
        }}
        onKeyDown={(event) => {
          if (isEditing) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            const target = event.target as HTMLElement;
            if (target.closest("button, a, input, textarea")) {
              return;
            }
            event.preventDefault();
            beginEditing();
          }
        }}
        tabIndex={isEditing ? -1 : 0}
        role="group"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle
                role="button"
                tabIndex={isEditing ? -1 : 0}
                onClick={beginEditing}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    beginEditing();
                  }
                }}
                className={cn(
                  "text-2xl font-semibold text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  !isEditing && "cursor-text hover:text-primary",
                  isEditing && "cursor-default",
                )}
              >
                {syncedIdea.title}
              </CardTitle>
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
            <div className="relative" ref={actionsMenuRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "interactive-btn flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-transparent",
                  isActionsOpen && "bg-muted/30",
                )}
                onClick={() => setIsActionsOpen((previous) => !previous)}
                aria-haspopup="menu"
                aria-expanded={isActionsOpen}
                data-testid="idea-actions-button"
              >
                Actions
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform text-muted-foreground",
                    isActionsOpen ? "rotate-180" : "rotate-0",
                  )}
                  aria-hidden="true"
                />
              </Button>
              {isActionsOpen ? (
                <div
                  className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border/60 bg-card shadow-xl"
                  role="menu"
                  aria-label="Idea actions"
                >
                  <div className="py-1 text-sm text-muted-foreground">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleExportIdea}
                      disabled={isExporting}
                      data-testid="idea-export-button"
                    >
                      <span>Export idea</span>
                      {isExporting ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleToggleConvert}
                      disabled={isConverting}
                      data-testid="idea-convert-toggle"
                    >
                      <span>{isConvertOpen ? "Close convert panel" : "Convert to feature"}</span>
                      {isConverting ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleDelete}
                      disabled={isPending}
                      data-testid="idea-delete-button"
                    >
                      <span>Delete idea</span>
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 space-y-6">
          {isConvertOpen ? (
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Core plan</h3>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center text-xs font-medium text-primary underline-offset-4 transition hover:underline"
                  onClick={() => setIsCoreExpanded((previous) => !previous)}
                >
                  {isCoreExpanded ? "Hide details" : "Show details"}
                </button>
              </div>
              <AnimatePresence initial={false} mode="wait">
                {isCoreExpanded ? (
                  <motion.div
                    key="core-expanded"
                    layout
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="rounded-xl border border-border/70 bg-card/70 p-4"
                  >
                    {syncedIdea.notes.trim() ? (
                      <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{syncedIdea.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No core plan captured yet.</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <LinkIcon className="size-4" /> {linkLabelDisplay}
              </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-btn h-8 w-8 cursor-pointer text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                onClick={() => {
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

        <FeatureComposer ideaId={idea.id} />

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
