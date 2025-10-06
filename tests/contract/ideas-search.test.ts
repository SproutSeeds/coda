import request from "supertest";
import { describe, expect, it } from "vitest";

import { closeTestApp, createTestApp } from "../helpers/test-app";

describe("GET /api/ideas/search", () => {
  it("returns results matching the query", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .get("/api/ideas/search?q=undo")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0].title.toLowerCase()).toContain("undo");
    } finally {
      await closeTestApp(app);
    }
  });

  it("returns 400 when query is missing", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .get("/api/ideas/search")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });

  it("rate limits repeated searches", async () => {
    const app = await createTestApp();

    try {
      await request(app as any)
        .get("/api/ideas/search?q=undo")
        .set("Authorization", "Bearer owner-token");

      const throttled = await request(app as any)
        .get("/api/ideas/search?q=undo")
        .set("Authorization", "Bearer owner-token");

      expect(throttled.status).toBe(429);
    } finally {
      await closeTestApp(app);
    }
  });
});
