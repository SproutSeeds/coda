import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

type Row = Record<string, unknown>;

const field = <T>(row: Row | undefined, key: string): T | null => {
  const value = row?.[key];
  return (value as T | undefined) ?? null;
};

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const out: Record<string, unknown> = {};
  try {
    const ctxRows = (await db.execute(sql`select current_user, current_database();`)) as Row[];
    const ctx = ctxRows[0];
    out.currentUser = field<string | null>(ctx, "current_user");
    out.currentDatabase = field<string | null>(ctx, "current_database");
  } catch (e: unknown) {
    out.currentUser = null;
    out.currentDatabase = null;
    out.ctxError = errorMessage(e);
  }

  try {
    const spRows = (await db.execute(sql`show search_path;`)) as Row[];
    out.searchPath = field<string | null>(spRows[0], "search_path");
  } catch {
    out.searchPath = null;
  }

  try {
    const regsRows = (await db.execute(
      sql`select to_regclass('public.dev_jobs') as dev_jobs, to_regclass('public.dev_logs') as dev_logs;`,
    )) as Row[];
    out.reg = regsRows[0] ?? null;
  } catch (e: unknown) {
    out.reg = { error: errorMessage(e) };
  }

  try {
    const tables = (await db.execute(
      sql`select table_schema, table_name from information_schema.tables where table_name in ('dev_jobs','dev_logs') order by table_name;`,
    )) as Row[];
    out.tables = tables;
  } catch (e: unknown) {
    out.tables = { error: errorMessage(e) };
  }

  try {
    const colsJobs = (await db.execute(
      sql`select column_name, data_type from information_schema.columns where table_name = 'dev_jobs' order by ordinal_position;`,
    )) as Row[];
    const colsLogs = (await db.execute(
      sql`select column_name, data_type from information_schema.columns where table_name = 'dev_logs' order by ordinal_position;`,
    )) as Row[];
    out.columns = { dev_jobs: colsJobs, dev_logs: colsLogs };
  } catch (e: unknown) {
    out.columns = { error: errorMessage(e) };
  }

  try {
    const jobsRows = (await db.execute(sql`select count(*)::int as n from dev_jobs;`)) as Row[];
    const logsRows = (await db.execute(sql`select count(*)::int as n from dev_logs;`)) as Row[];
    out.counts = {
      dev_jobs: field<number | null>(jobsRows[0], "n"),
      dev_logs: field<number | null>(logsRows[0], "n"),
    };
  } catch (e: unknown) {
    out.counts = { error: errorMessage(e) };
  }

  try {
    const minsRows = (await db.execute(
      sql`select min(created_at) as min_created, max(created_at) as max_created from dev_jobs;`,
    )) as Row[];
    out.jobsCreatedAt = minsRows[0] ?? null;
  } catch {}

  try {
    const privJobsRows = (await db.execute(
      sql`select 
            has_table_privilege(current_user, 'public.dev_jobs', 'SELECT') as sel,
            has_table_privilege(current_user, 'public.dev_jobs', 'INSERT') as ins,
            has_table_privilege(current_user, 'public.dev_jobs', 'UPDATE') as upd,
            has_table_privilege(current_user, 'public.dev_jobs', 'DELETE') as del;`,
    )) as Row[];
    const privLogsRows = (await db.execute(
      sql`select 
            has_table_privilege(current_user, 'public.dev_logs', 'SELECT') as sel,
            has_table_privilege(current_user, 'public.dev_logs', 'INSERT') as ins,
            has_table_privilege(current_user, 'public.dev_logs', 'UPDATE') as upd,
            has_table_privilege(current_user, 'public.dev_logs', 'DELETE') as del;`,
    )) as Row[];
    out.privileges = { dev_jobs: privJobsRows[0] ?? null, dev_logs: privLogsRows[0] ?? null };
  } catch (e: unknown) {
    out.privileges = { error: errorMessage(e) };
  }

  return NextResponse.json(out);
}
