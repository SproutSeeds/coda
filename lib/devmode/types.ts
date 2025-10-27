export type RepoRef = {
  provider: "github";
  repo: string; // owner/repo
  branch?: string;
  sha?: string;
};

export type CreateJobRequest = {
  ideaId: string;
  intent: string;
  repoRef?: RepoRef;
  env?: Record<string, string>;
  timeoutMs?: number;
  idempotencyKey: string;
};

export type CreateJobResponse = {
  jobId: string;
  wsToken: string; // short-lived token for log ingress
  previewUrl?: string;
};

export type JobState =
  | "queued"
  | "dispatched"
  | "running"
  | "uploading"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export type LogEvent = {
  type: "log";
  jobId: string;
  ts: number;
  level: "info" | "warn" | "error";
  line: string;
};

export type MessageEvent = {
  type: "message";
  jobId: string;
  seq: number;
  ts: number;
  sender: "user" | "codex" | "system";
  content: string;
};

export type StreamEvent = LogEvent | MessageEvent;

