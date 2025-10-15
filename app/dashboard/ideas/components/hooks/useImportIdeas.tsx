"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  importIdeasAction,
  type ImportIdeasCommitResponse,
  type ImportIdeasPreviewResponse,
} from "@/app/dashboard/ideas/actions/import";
import { normalizeIdeaTitle, type ConflictDecision } from "@/lib/validations/import";

export type ImportDecisionAction = "update" | "create-new";

interface UseImportIdeasOptions {
  onResetInput?: () => void;
}

export interface ImportIdeaRow {
  normalizedTitle: string;
  ideaTitle: string;
  existingIdeaId: string | null;
  hasConflict: boolean;
  warnings: string[];
}

interface ImportToasts {
  success(summary: ImportIdeasCommitResponse["summary"]): void;
  error(message: string): void;
}

function buildToasts(): ImportToasts {
  return {
    success(summary) {
      toast.custom(
        () => (
          <div
            data-testid="import-toast-success"
            className="pointer-events-auto w-full max-w-sm rounded-lg border border-border bg-background/80 p-4 shadow-lg backdrop-blur"
          >
            <p className="text-sm font-semibold">Ideas imported</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {summary.createdIdeas} ideas • Updated {summary.updatedIdeas} ideas • Added {summary.createdFeatures}
              features
            </p>
          </div>
        ),
        { duration: 5000 },
      );
    },
    error(message) {
      toast.custom(
        () => (
          <div
            data-testid="import-toast-error"
            className="pointer-events-auto w-full max-w-sm rounded-lg border border-destructive bg-background/80 p-4 text-destructive shadow-lg backdrop-blur"
          >
            <p className="text-sm font-semibold">Import failed</p>
            <p className="mt-1 text-xs">{message}</p>
          </div>
        ),
        { duration: 6000 },
      );
    },
  };
}

export function useImportIdeas({ onResetInput }: UseImportIdeasOptions = {}) {
  const router = useRouter();
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isCommitting, startCommitTransition] = useTransition();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportIdeasPreviewResponse["diff"] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [decisions, setDecisions] = useState<Map<string, ImportDecisionAction>>(new Map());
  const [applyToAllAction, setApplyToAllAction] = useState<ImportDecisionAction | null>(null);
  const [rows, setRows] = useState<ImportIdeaRow[]>([]);

  const toasts = useMemo(buildToasts, []);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setDialogOpen(false);
    setDecisions(new Map());
    setApplyToAllAction(null);
    setRows([]);
    onResetInput?.();
  }, [onResetInput]);

  const handleFileChange = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) {
        return;
      }
      setSelectedFile(file);
      startPreviewTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("stage", "preview");
          formData.set("file", file);
          const response = await importIdeasAction(formData);
          if (response.status !== "preview") {
            throw new Error("Unexpected response from import preview");
          }

          const mappedRows: ImportIdeaRow[] = response.diff.entries.map((entry) => ({
            normalizedTitle: entry.normalizedTitle,
            ideaTitle: entry.bundle.idea.title,
            existingIdeaId: entry.existingIdea?.id ?? null,
            hasConflict: entry.hasConflict,
            warnings: entry.warnings,
          }));

          const defaultDecisions = new Map<string, ImportDecisionAction>();
          mappedRows.forEach((row) => {
            const normalized = row.normalizedTitle || normalizeIdeaTitle(row.ideaTitle);
            defaultDecisions.set(normalized, row.hasConflict ? "update" : "create-new");
          });

          setPreview(response.diff);
          setRows(mappedRows);
          setDecisions(defaultDecisions);
          setApplyToAllAction(null);
          setDialogOpen(true);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to analyse import";
          toasts.error(message);
          resetState();
        }
      });
    },
    [resetState, toasts, startPreviewTransition],
  );

  const updateDecision = useCallback(
    (normalizedTitle: string, action: ImportDecisionAction, options?: { applyToAll?: boolean }) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(normalizedTitle, action);
        return next;
      });

      if (options?.applyToAll) {
        setApplyToAllAction(action);
        setDecisions((prev) => {
          const next = new Map(prev);
          rows.forEach((row) => {
            if (!row.hasConflict && action === "update") {
              next.set(row.normalizedTitle, "create-new");
            } else {
              next.set(row.normalizedTitle, row.hasConflict ? action : "create-new");
            }
          });
          return next;
        });
      }
    },
    [rows],
  );

  const clearApplyToAll = useCallback(() => {
    setApplyToAllAction(null);
  }, []);

  const confirmImport = useCallback(() => {
    if (!selectedFile || !preview) {
      toasts.error("Select a JSON export before importing");
      return;
    }

    startCommitTransition(async () => {
      try {
        const decisionsPayload = rows.map((row) => {
          const normalized = row.normalizedTitle;
          const action = applyToAllAction ?? decisions.get(normalized) ?? (row.hasConflict ? "update" : "create-new");
          if (row.hasConflict && action !== "update" && action !== "create-new") {
            throw new Error(`Choose how to handle duplicates for "${row.ideaTitle}"`);
          }
          return {
            ideaTitle: row.ideaTitle,
            action,
            applyToAll: applyToAllAction ? true : undefined,
          } satisfies ConflictDecision;
        });

        const formData = new FormData();
        formData.set("stage", "commit");
        formData.set("file", selectedFile);
        if (decisionsPayload.length > 0) {
          formData.set("decisions", JSON.stringify(decisionsPayload));
        }

        const response = await importIdeasAction(formData);
        if (response.status !== "complete") {
          throw new Error("Unexpected response from import commit");
        }

        toasts.success(response.summary);
        resetState();
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed";
        toasts.error(message);
      }
    });
  }, [applyToAllAction, rows, decisions, preview, resetState, router, selectedFile, startCommitTransition, toasts]);

  const hasConflicts = rows.some((row) => row.hasConflict);

  return {
    handleFileChange,
    isPreviewing,
    isCommitting,
    dialogOpen,
    setDialogOpen,
    preview,
    decisions,
    rows,
    hasConflicts,
    updateDecision,
    applyToAllAction,
    clearApplyToAll,
    confirmImport,
    resetState,
  };
}
