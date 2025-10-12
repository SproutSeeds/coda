import { describe, expect, it } from "vitest";

import {
  sanitizeIdeaNotes,
  validateIdeaInput,
  validateIdeaUpdate,
} from "@/lib/validations/ideas";

const validIdea = {
  title: "Ship multiplayer undo",
  notes: "## Idea\n- support collaborative editing\n- require optimistic UI",
};

describe("Idea validation", () => {
  it("allows a well-formed idea payload", () => {
    expect(() => validateIdeaInput(validIdea)).not.toThrow();
  });

  it("rejects titles that exceed 255 characters", () => {
    const overlong = {
      ...validIdea,
      title: "a".repeat(256),
    };

    expect(() => validateIdeaInput(overlong)).toThrow();
  });

  it("rejects empty notes", () => {
    const emptyNotes = {
      ...validIdea,
      notes: "",
    };

    expect(() => validateIdeaInput(emptyNotes)).toThrow();
  });

  it("sanitizes Markdown notes by stripping script tags", () => {
    const dirty = "<script>alert('hack')</script>**bold**";
    const sanitized = sanitizeIdeaNotes(dirty);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("bold");
  });

  it("requires at least one field when updating an idea", () => {
    expect(() => validateIdeaUpdate({ id: "idea-1" })).toThrow();
  });

  it("allows partial updates when constraints are met", () => {
    expect(() =>
      validateIdeaUpdate({
        id: "idea-1",
        title: "Refined title",
      }),
    ).not.toThrow();
  });
});
