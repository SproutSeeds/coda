import crypto from "node:crypto";

import express, { type NextFunction, type Request, type Response } from "express";

import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit, resetRateLimitStore } from "@/lib/utils/rate-limit";
import {
  consumeUndoToken,
  createUndoToken,
  isUndoTokenExpired,
  resetUndoStore,
  seedUndoToken,
} from "@/lib/utils/undo";
import {
  IdeaInput,
  IdeaUpdateInput,
  sanitizeIdeaNotes,
  validateIdeaInput,
  validateIdeaUpdate,
} from "@/lib/validations/ideas";

export type Idea = {
  id: string;
  userId: string;
  title: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  undoToken?: string;
  undoExpiresAt?: number;
};

export type TestApp = express.Express & {
  locals: {
    ideas: Map<string, Idea>;
  };
};

function requireAuth(req: Request, res: Response): string | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return undefined;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return undefined;
  }
  return token;
}

function handleAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export async function createTestApp(): Promise<TestApp> {
  resetRateLimitStore();
  resetUndoStore();

  const app = express() as TestApp;
  app.use(express.json());
  app.locals.ideas = new Map();

  const ideas = app.locals.ideas;

  seedInitialData(ideas);

  app.post(
    "/api/ideas",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const rate = await consumeRateLimit(`${userId}:create`);
      if (!rate.success) {
        res.status(429).json({ reset: rate.reset });
        return;
      }

      let payload: IdeaInput;
      try {
        payload = validateIdeaInput(req.body as IdeaInput);
      } catch (error) {
        if (isValidationError(error)) {
          res.status(400).json({ error: formatValidationError(error) });
          return;
        }
        throw error;
      }
      const now = Date.now();
      const idea: Idea = {
        id: crypto.randomUUID(),
        userId,
        title: payload.title,
        notes: sanitizeIdeaNotes(payload.notes),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      ideas.set(idea.id, idea);
      await trackEvent({ name: "idea_created", properties: { ideaId: idea.id } });

      res.status(201).json(formatIdea(idea));
    }),
  );

  app.patch(
    "/api/ideas/:id",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const idea = ideas.get(req.params.id);
      if (!idea) {
        res.status(404).json({ error: "Idea not found" });
        return;
      }

      if (idea.userId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (req.body.updatedAt && req.body.updatedAt !== idea.updatedAt) {
        res.status(409).json({ error: "Conflict" });
        return;
      }

      let payload: IdeaUpdateInput;
      try {
        payload = validateIdeaUpdate({ id: idea.id, ...req.body } as IdeaUpdateInput);
      } catch (error) {
        if (isValidationError(error)) {
          res.status(400).json({ error: formatValidationError(error) });
          return;
        }
        throw error;
      }
      if (payload.title) idea.title = payload.title;
      if (payload.notes) idea.notes = sanitizeIdeaNotes(payload.notes);
      idea.updatedAt = Date.now();

      await trackEvent({ name: "idea_updated", properties: { ideaId: idea.id } });
      res.json(formatIdea(idea));
    }),
  );

  app.get(
    "/api/ideas",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const limit = Number.parseInt((req.query.limit as string) ?? "20", 10);
      const cursor = req.query.cursor as string | undefined;

      const items = Array.from(ideas.values())
        .filter((idea) => idea.userId === userId && !idea.deletedAt)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      let startIndex = 0;
      if (cursor) {
        const index = items.findIndex((idea) => idea.id === cursor);
        if (index >= 0) startIndex = index + 1;
      }

      const slice = items.slice(startIndex, startIndex + limit);
      const nextCursor = slice.length === limit ? slice[slice.length - 1].id : null;

      res.json({ items: slice.map(formatIdea), nextCursor });
    }),
  );

  app.get(
    "/api/ideas/search",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const query = (req.query.q as string | undefined)?.trim();
      if (!query) {
        res.status(400).json({ error: "Missing query" });
        return;
      }

      const rate = await consumeRateLimit(`${userId}:search`);
      if (!rate.success) {
        res.status(429).json({ reset: rate.reset });
        return;
      }

      const q = query.toLowerCase();
      const results = Array.from(ideas.values())
        .filter((idea) => idea.userId === userId && !idea.deletedAt)
        .filter((idea) => idea.title.toLowerCase().includes(q) || idea.notes.toLowerCase().includes(q));

      res.json({ items: results.map(formatIdea) });
    }),
  );

  app.delete(
    "/api/ideas/:id",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const idea = ideas.get(req.params.id);
      if (!idea || idea.userId !== userId) {
        res.status(404).json({ error: "Idea not found" });
        return;
      }

      idea.deletedAt = Date.now();
      const undo = createUndoToken(idea.id);
      idea.undoToken = undo.token;
      idea.undoExpiresAt = undo.expiresAt.getTime();

      await trackEvent({ name: "idea_deleted", properties: { ideaId: idea.id } });
      res.json({ undoToken: undo.token, expiresAt: undo.expiresAt });
    }),
  );

  app.post(
    "/api/ideas/:id/restore",
    handleAsync(async (req, res) => {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const idea = ideas.get(req.params.id);
      if (!idea || idea.userId !== userId) {
        res.status(404).json({ error: "Idea not found" });
        return;
      }

      const token = (req.body?.token as string | undefined) ?? "";
      const record = consumeUndoToken(token);

      if (!record || record.ideaId !== idea.id) {
        res.status(410).json({ error: "Undo token expired" });
        return;
      }

      if (isUndoTokenExpired(record)) {
        res.status(410).json({ error: "Undo token expired" });
        return;
      }

      idea.deletedAt = null;
      idea.undoToken = undefined;
      idea.undoExpiresAt = undefined;
      idea.updatedAt = Date.now();

      await trackEvent({ name: "idea_restored", properties: { ideaId: idea.id } });
      res.json(formatIdea(idea));
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isValidationError(err)) {
      res.status(400).json({ error: formatValidationError(err) });
      return;
    }
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err });
  });

  return app;
}

export async function closeTestApp(_app?: TestApp) {
  // No-op: supertest handles Express lifecycle, but the function exists for API parity.
}

function seedInitialData(store: Map<string, Idea>) {
  store.clear();

  const now = Date.now();
  for (let index = 0; index < 12; index += 1) {
    const id = index === 0 ? "idea-123" : `seed-idea-${index}`;
    const idea: Idea = {
      id,
      userId: "owner-token",
      title: index === 0 ? "Undo improvements" : `Seed idea ${index}`,
      notes: index === 0 ? "Ensure undo window is 10 seconds" : `Details for seed idea ${index}`,
      createdAt: now - index * 1_000,
      updatedAt: now - index * 1_000,
      deletedAt: null,
    };
    store.set(id, idea);
  }

  seedUndoToken({ token: "valid-token", ideaId: "idea-123", expiresAt: new Date(Date.now() + 5_000) });
  seedUndoToken({ token: "expired-token", ideaId: "idea-123", expiresAt: new Date(Date.now() - 1_000) });
}

function formatIdea(idea: Idea) {
  return {
    ...idea,
    deletedAt: idea.deletedAt ?? null,
  };
}

type ValidationError = { issues?: Array<{ message: string }> };

function isValidationError(error: unknown): error is ValidationError {
  return typeof error === "object" && error !== null && Array.isArray((error as ValidationError).issues);
}

function formatValidationError(error: ValidationError): string {
  return error.issues?.map((issue) => issue.message).join(", ") ?? "Invalid payload";
}
