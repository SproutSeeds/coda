# Contract — importIdeasAction

**Type**: Server Action (Node runtime)

## Purpose
Process a user-uploaded JSON payload that matches the export schema, compute a diff summary, prompt for conflict resolutions, and (upon confirmation) persist new or updated ideas/features.

## Request Shape
```ts
interface ImportIdeasRequest {
  file: File; // JSON, max 5 MB
  confirmation?: {
    conflicts: Array<{
      ideaTitle: string;
      action: "update" | "create-new";
      applyToAll?: boolean;
    }>;
  };
}
```

- Initial submission provides only `file`.
- After preview, client resubmits with the same `file` reference plus `confirmation` decisions.

## Response (Preview Phase)
```ts
interface ImportIdeasPreviewResponse {
  status: "preview";
  diff: {
    newIdeas: number;
    updatedIdeas: number;
    unchangedIdeas: number;
    newFeatures: number;
    updatedFeatures: number;
    skippedFeatures: number;
    conflicts: Array<{
      ideaTitle: string;
      duplicates: number; // count of matching existing ideas (usually 1)
    }>;
    messages: string[];
  };
}
```

## Response (Commit Phase)
```ts
interface ImportIdeasCommitResponse {
  status: "complete";
  summary: {
    createdIdeas: number;
    updatedIdeas: number;
    createdFeatures: number;
    updatedFeatures: number;
    skipped: number;
  };
}
```

## Failure Modes
- `400 Bad Request`: Invalid JSON, schema mismatch, or size > 5 MB.
- `401 Unauthorized`: User session missing or expired.
- `409 Conflict`: Conflict decisions missing when duplicates detected.
- `422 Unprocessable Entity`: Attempt to update ideas/features not owned by the user.
- `500 Internal Error`: Unexpected parsing/storage failure (logged with context).

## Security & Validation
- Require authenticated session (`requireUser`).
- Validate file type and size before reading into memory.
- Parse via drizzle-zod schema; strip unsupported properties.
- Ensure imported idea/feature IDs belong to current user when present.

## Observability
- Emit `ideas_import_attempt`, `ideas_import_complete`, and `ideas_import_error` events with summary metadata.
