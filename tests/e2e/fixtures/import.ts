import { join } from "node:path";

const FIXTURE_DIR = join(__dirname, "../../fixtures/import");

export function importFixturePath(variant: "valid" | "invalid" = "valid") {
  if (variant === "invalid") {
    return join(FIXTURE_DIR, "invalid.json");
  }
  return join(FIXTURE_DIR, "export-sample.json");
}
