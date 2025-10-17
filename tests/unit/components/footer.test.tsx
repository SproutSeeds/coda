/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/footer";

vi.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={href?.toString()} {...rest}>
        {children}
      </a>
    ),
  };
});

describe("Footer", () => {
  it("renders a GitHub link with accessible name", () => {
    render(<Footer />);

    const githubLink = screen.getByRole("link", { name: /coda on github/i });

    expect(githubLink.getAttribute("href")).toBe("https://github.com/SproutSeeds/coda");
  });
});
