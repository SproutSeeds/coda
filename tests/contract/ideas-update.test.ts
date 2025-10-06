import request from "supertest";
import { describe, expect, it } from "vitest";

import { closeTestApp, createTestApp } from "../helpers/test-app";

describe("PATCH /api/ideas/:id", () => {
  it("updates an idea the owner created", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .patch("/api/ideas/idea-123")
        .send({ title: "Updated title" })
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Updated title");
    } finally {
      await closeTestApp(app);
    }
  });

  it("returns 403 when a different user attempts to update", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .patch("/api/ideas/idea-123")
        .send({ title: "Hacked title" })
        .set("Authorization", "Bearer intruder");

      expect(response.status).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it("guards against concurrent updates", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .patch("/api/ideas/idea-123")
        .send({ title: "Latest title", updatedAt: "stale-timestamp" })
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(409);
    } finally {
      await closeTestApp(app);
    }
  });
});
