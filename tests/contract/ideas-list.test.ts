import request from "supertest";
import { describe, expect, it } from "vitest";

import { closeTestApp, createTestApp } from "../helpers/test-app";

describe("GET /api/ideas", () => {
  it("returns ideas in reverse chronological order", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .get("/api/ideas")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items[0]?.createdAt).toBeGreaterThan(
        response.body.items[response.body.items.length - 1]?.createdAt,
      );
    } finally {
      await closeTestApp(app);
    }
  });

  it("supports pagination via cursor", async () => {
    const app = await createTestApp();

    try {
      const page1 = await request(app as any)
        .get("/api/ideas?limit=10")
        .set("Authorization", "Bearer owner-token");
      expect(page1.status).toBe(200);
      expect(page1.body.nextCursor).toBeDefined();

      const page2 = await request(app as any)
        .get(`/api/ideas?limit=10&cursor=${page1.body.nextCursor}`)
        .set("Authorization", "Bearer owner-token");

      expect(page2.status).toBe(200);
      expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
    } finally {
      await closeTestApp(app);
    }
  });

  it("returns an empty array when the user has no ideas", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .get("/api/ideas")
        .set("Authorization", "Bearer brand-new");

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    } finally {
      await closeTestApp(app);
    }
  });
});
