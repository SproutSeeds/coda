import request from "supertest";
import { describe, expect, it } from "vitest";

import { closeTestApp, createTestApp } from "../helpers/test-app";

describe("DELETE /api/ideas/:id and POST /api/ideas/:id/restore", () => {
  it("returns an undo token when deleting", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .delete("/api/ideas/idea-123")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.undoToken).toBeDefined();
    } finally {
      await closeTestApp(app);
    }
  });

  it("restores an idea when the undo token is valid", async () => {
    const app = await createTestApp();

    try {
      const undoToken = "valid-token";
      const response = await request(app as any)
        .post("/api/ideas/idea-123/restore")
        .send({ token: undoToken })
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
    } finally {
      await closeTestApp(app);
    }
  });

  it("returns 410 when the undo token has expired", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .post("/api/ideas/idea-123/restore")
        .send({ token: "expired-token" })
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(410);
    } finally {
      await closeTestApp(app);
    }
  });
});
