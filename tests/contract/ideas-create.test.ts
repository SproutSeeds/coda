import request from "supertest";
import { describe, expect, it } from "vitest";

import { closeTestApp, createTestApp } from "../helpers/test-app";

describe("POST /api/ideas", () => {
  it("creates an idea and returns 201", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .post("/api/ideas")
        .send({ title: "Ship realtime undo", notes: "Support 10s window" })
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: "Ship realtime undo",
        notes: expect.any(String),
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it("validates payloads and returns 400 when invalid", async () => {
    const app = await createTestApp();

    try {
      const response = await request(app as any)
        .post("/api/ideas")
        .send({ title: "", notes: "" })
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });

  it("enforces rate limiting", async () => {
    const app = await createTestApp();

    try {
      // Simulate hitting the endpoint twice rapidly to trigger limiter.
      await request(app as any)
        .post("/api/ideas")
        .send({ title: "a", notes: "b" })
        .set("Authorization", "Bearer test-token");

      const throttled = await request(app as any)
        .post("/api/ideas")
        .send({ title: "a", notes: "b" })
        .set("Authorization", "Bearer test-token");

      expect(throttled.status).toBe(429);
    } finally {
      await closeTestApp(app);
    }
  });
});
