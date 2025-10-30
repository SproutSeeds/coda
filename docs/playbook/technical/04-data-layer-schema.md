# Data Layer & Schema Documentation

## Executive Summary

This document provides comprehensive documentation of Coda's data layer, including Postgres schema design, Drizzle ORM usage, migration workflows, indexing strategies, and query optimization patterns.

## Database Architecture

### Technology Stack

- **Database:** PostgreSQL 15+ (Neon for dev, Vercel Postgres for prod)
- **ORM:** Drizzle ORM (type-safe, SQL-first)
- **Validation:** drizzle-zod (schema-to-Zod conversion)
- **Connection Pooling:** Neon serverless driver + connection pooling
- **Migrations:** Drizzle Kit (generates SQL from schema changes)

### Environment Configuration

**Development:**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/coda"
# or
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/coda"
```

**Production (Vercel):**
```env
DATABASE_URL="postgresql://user:pass@db.vercel-storage.com/coda"
# Auto-configured when Vercel Postgres is linked
```

### Connection Management

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Connection configuration
const client = postgres(connectionString, {
  max: 10, // Max connections (Neon free tier: 1000)
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout
});

export const db = drizzle(client, { schema });
```

## Core Schema Design

### Entity Relationship Diagram

```
users (Auth.js)
  │
  ├─── ideas (1:N)
  │      │
  │      ├─── idea_features (1:N)
  │      │
  │      └─── dev_jobs (1:N)
  │             │
  │             └─── dev_logs (1:N)
  │
  ├─── accounts (1:N, Auth.js)
  ├─── sessions (1:N, Auth.js)
  └─── dev_pairings (1:N)
```

### Schema Definitions

#### 1. Users (Auth.js)

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey().notNull(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Auth.js adapter tables
export const accounts = pgTable('accounts', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compoundKey: primaryKey(account.provider, account.providerAccountId),
}));

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey().notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey(vt.identifier, vt.token),
}));
```

#### 2. Ideas

```typescript
export const ideas = pgTable('ideas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  position: integer('position').notNull(),
  starred: boolean('starred').default(false).notNull(),
  superStarred: boolean('super_starred').default(false).notNull(),
  githubUrl: text('github_url'),
  linkLabel: text('link_label'),
  deletedAt: timestamp('deleted_at'),
  undoToken: text('undo_token'),
  undoExpiresAt: timestamp('undo_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const ideasUserIdIdx = index('ideas_user_id_idx').on(ideas.userId);
export const ideasPositionIdx = index('ideas_position_idx').on(ideas.userId, ideas.position);
export const ideasStarredIdx = index('ideas_starred_idx').on(ideas.userId, ideas.starred);
export const ideasDeletedAtIdx = index('ideas_deleted_at_idx').on(ideas.deletedAt);
```

**Design Decisions:**

1. **UUID primary key:** Prevents ID enumeration attacks, works well with distributed systems
2. **Soft delete:** `deletedAt` + `undoToken` + `undoExpiresAt` enable 7-day recovery window
3. **Position field:** Integer for drag-and-drop ordering (no fractional positions needed)
4. **Starred vs superStarred:** Two-tier prioritization (superStarred = highest priority)
5. **GitHub URL + linkLabel:** Optional external tracking integration

#### 3. Idea Features

```typescript
export const ideaFeatures = pgTable('idea_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  detail: text('detail'),
  detailSections: jsonb('detail_sections').$type<DetailSection[]>(),
  position: integer('position').notNull(),
  starred: boolean('starred').default(false).notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const ideasFeaturesIdeaIdIdx = index('idea_features_idea_id_idx').on(ideaFeatures.ideaId);
export const ideasFeaturesPositionIdx = index('idea_features_position_idx').on(ideaFeatures.ideaId, ideaFeatures.position);

// TypeScript types
export interface DetailSection {
  id: string;
  title: string;
  content: string;
  collapsed?: boolean;
}
```

**Design Decisions:**

1. **Cascade delete:** Features deleted when parent idea deleted
2. **JSONB detailSections:** Flexible nested content structure without additional tables
3. **completedAt timestamp:** Tracks when feature was marked done (nullable)
4. **No soft delete:** Features inherit parent idea's deletion status

#### 4. Dev Mode Tables

**Jobs:**

```typescript
export const devJobs = pgTable('dev_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  command: text('command').notNull(),
  cwd: text('cwd'),
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  exitCode: integer('exit_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const devJobsIdeaIdIdx = index('dev_jobs_idea_id_idx').on(devJobs.ideaId);
export const devJobsUserIdIdx = index('dev_jobs_user_id_idx').on(devJobs.userId);
export const devJobsStatusIdx = index('dev_jobs_status_idx').on(devJobs.status);
```

**Logs:**

```typescript
export const devLogs = pgTable('dev_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => devJobs.id, { onDelete: 'cascade' }),
  level: text('level').notNull(), // info, warn, error, debug
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const devLogsJobIdIdx = index('dev_logs_job_id_idx').on(devLogs.jobId);
export const devLogsTimestampIdx = index('dev_logs_timestamp_idx').on(devLogs.jobId, devLogs.timestamp);
```

**Pairings:**

```typescript
export const devPairings = pgTable('dev_pairings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pairingCode: text('pairing_code').notNull().unique(),
  pairingJti: text('pairing_jti').notNull().unique(), // JWT ID for polling
  approvedAt: timestamp('approved_at'),
  expiresAt: timestamp('expires_at').notNull(),
  runnerType: text('runner_type'), // desktop, cli
  runnerVersion: text('runner_version'),
  hostname: text('hostname'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const devPairingsPairingCodeIdx = index('dev_pairings_pairing_code_idx').on(devPairings.pairingCode);
export const devPairingsPairingJtiIdx = index('dev_pairings_pairing_jti_idx').on(devPairings.pairingJti);
export const devPairingsExpiresAtIdx = index('dev_pairings_expires_at_idx').on(devPairings.expiresAt);
```

**Design Decisions:**

1. **Job status enum:** Tracks job lifecycle (pending → running → completed/failed)
2. **Separate logs table:** Enables high-volume log ingestion without job table bloat
3. **Timestamp in logs:** Separate from createdAt to preserve original log time
4. **Pairing JTI:** Unique ID for long-polling status checks
5. **Metadata fields:** runnerType, runnerVersion, hostname for telemetry

### Relations

```typescript
// lib/db/schema.ts
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  ideas: many(ideas),
  devJobs: many(devJobs),
  devPairings: many(devPairings),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  user: one(users, {
    fields: [ideas.userId],
    references: [users.id],
  }),
  features: many(ideaFeatures),
  devJobs: many(devJobs),
}));

export const ideaFeaturesRelations = relations(ideaFeatures, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaFeatures.ideaId],
    references: [ideas.id],
  }),
}));

export const devJobsRelations = relations(devJobs, ({ one, many }) => ({
  idea: one(ideas, {
    fields: [devJobs.ideaId],
    references: [ideas.id],
  }),
  user: one(users, {
    fields: [devJobs.userId],
    references: [users.id],
  }),
  logs: many(devLogs),
}));

export const devLogsRelations = relations(devLogs, ({ one }) => ({
  job: one(devJobs, {
    fields: [devLogs.jobId],
    references: [devJobs.id],
  }),
}));

export const devPairingsRelations = relations(devPairings, ({ one }) => ({
  user: one(users, {
    fields: [devPairings.userId],
    references: [users.id],
  }),
}));
```

## Validation Layer (Zod)

### Schema Generation

```typescript
// lib/validations/ideas.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { ideas, ideaFeatures } from '@/lib/db/schema';
import { z } from 'zod';

// Base schemas (auto-generated from Drizzle)
export const insertIdeaSchema = createInsertSchema(ideas, {
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  notes: z.string().max(10000, 'Notes too long').optional(),
  position: z.number().int().nonnegative(),
  githubUrl: z.string().url().optional().or(z.literal('')),
});

export const selectIdeaSchema = createSelectSchema(ideas);

// Partial update schema
export const updateIdeaSchema = insertIdeaSchema.partial().extend({
  id: z.string().uuid(),
});

// Export types
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type SelectIdea = z.infer<typeof selectIdeaSchema>;
export type UpdateIdea = z.infer<typeof updateIdeaSchema>;
```

### Custom Validation Logic

```typescript
// lib/validations/ideas.ts (continued)

// Feature schema with nested detail sections
export const insertIdeaFeatureSchema = createInsertSchema(ideaFeatures, {
  title: z.string().min(1).max(200),
  notes: z.string().max(5000).optional(),
  detail: z.string().max(20000).optional(),
  detailSections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    collapsed: z.boolean().optional(),
  })).optional(),
});

// Import/Export schema
export const ideaImportSchema = z.object({
  idea: z.object({
    title: z.string(),
    notes: z.string().optional(),
    starred: z.boolean().optional(),
    superStarred: z.boolean().optional(),
    githubUrl: z.string().url().optional(),
    linkLabel: z.string().optional(),
  }),
  features: z.array(z.object({
    title: z.string(),
    notes: z.string().optional(),
    detail: z.string().optional(),
    detailSections: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      collapsed: z.boolean().optional(),
    })).optional(),
    starred: z.boolean().optional(),
    completedAt: z.string().datetime().optional(),
  })),
});

export type IdeaImport = z.infer<typeof ideaImportSchema>;
```

## Migration Workflow

### Development Process

**1. Modify Schema:**

```typescript
// lib/db/schema.ts
export const ideas = pgTable('ideas', {
  // ... existing fields
  githubUrl: text('github_url'), // NEW FIELD
  linkLabel: text('link_label'), // NEW FIELD
});
```

**2. Generate Migration:**

```bash
pnpm db:generate
# Output: drizzle/migrations/0027_add_github_link.sql

# Drizzle analyzes schema diff and generates SQL:
# ALTER TABLE ideas ADD COLUMN github_url TEXT;
# ALTER TABLE ideas ADD COLUMN link_label TEXT;
```

**3. Review Generated SQL:**

```bash
cat drizzle/migrations/0027_add_github_link.sql
```

**Important:** Drizzle cannot detect column renames, so review carefully:

```sql
-- Drizzle will generate (WRONG):
ALTER TABLE ideas DROP COLUMN old_name;
ALTER TABLE ideas ADD COLUMN new_name TEXT;

-- Manual fix (CORRECT):
ALTER TABLE ideas RENAME COLUMN old_name TO new_name;
```

**4. Apply Migration:**

```bash
# Development
pnpm db:migrate

# Production (automatic via postbuild)
# See package.json: "postbuild": "pnpm db:migrate"
```

**5. Commit Schema + Migration:**

```bash
git add lib/db/schema.ts drizzle/migrations/0027_add_github_link.sql
git commit -m "feat: Add GitHub link fields to ideas table"
```

### Migration Best Practices

**1. Always add nullability for existing tables:**

```sql
-- Good: New columns are nullable
ALTER TABLE ideas ADD COLUMN github_url TEXT;

-- Bad: Non-null column without default will fail on existing rows
ALTER TABLE ideas ADD COLUMN github_url TEXT NOT NULL;
```

**2. Use transactions for multi-step migrations:**

```sql
BEGIN;

ALTER TABLE ideas ADD COLUMN github_url TEXT;
ALTER TABLE ideas ADD COLUMN link_label TEXT;
CREATE INDEX ideas_github_url_idx ON ideas(github_url);

COMMIT;
```

**3. Backfill data in separate migration:**

```sql
-- 0027_add_github_link.sql (add column)
ALTER TABLE ideas ADD COLUMN github_url TEXT;

-- 0028_backfill_github_links.sql (populate data)
UPDATE ideas SET github_url = 'https://github.com/...'
WHERE title LIKE '%GitHub%';
```

**4. Test migrations on staging before production:**

```bash
# Clone production database to staging
DATABASE_URL=$STAGING_DATABASE_URL pnpm db:migrate

# Verify migration worked
DATABASE_URL=$STAGING_DATABASE_URL psql -c "SELECT * FROM ideas LIMIT 1;"
```

### Critical Migrations (Historical)

**Commit `9e04a8c` - Add Dev Mode tables:**

```sql
-- drizzle/migrations/0022_add_devmode.sql
CREATE TABLE dev_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  cwd TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE dev_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES dev_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE dev_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pairing_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX dev_jobs_idea_id_idx ON dev_jobs(idea_id);
CREATE INDEX dev_logs_job_id_idx ON dev_logs(job_id);
```

**Commit `62556ee` - Add log batching fields:**

```sql
-- drizzle/migrations/0023_add_log_batching.sql
ALTER TABLE dev_jobs ADD COLUMN started_at TIMESTAMP;
ALTER TABLE dev_jobs ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE dev_jobs ADD COLUMN exit_code INTEGER;

CREATE INDEX dev_jobs_status_idx ON dev_jobs(status);
CREATE INDEX dev_logs_timestamp_idx ON dev_logs(job_id, timestamp);
```

## Query Patterns & Optimization

### 1. Fetching Ideas with Features

**Bad (N+1 query):**

```typescript
const ideas = await db.query.ideas.findMany({
  where: eq(ideas.userId, userId),
});

for (const idea of ideas) {
  const features = await db.query.ideaFeatures.findMany({
    where: eq(ideaFeatures.ideaId, idea.id),
  });
  idea.features = features;
}
```

**Good (Single query with relations):**

```typescript
const ideas = await db.query.ideas.findMany({
  where: eq(ideas.userId, userId),
  with: {
    features: {
      orderBy: [asc(ideaFeatures.position)],
    },
  },
  orderBy: [asc(ideas.position)],
});
```

### 2. Soft Delete Filtering

**Always filter out soft-deleted records:**

```typescript
import { and, eq, isNull } from 'drizzle-orm';

const activeIdeas = await db.query.ideas.findMany({
  where: and(
    eq(ideas.userId, userId),
    isNull(ideas.deletedAt) // Critical: exclude soft-deleted
  ),
});
```

**Helper function:**

```typescript
// lib/db/helpers.ts
import { SQL, and, isNull } from 'drizzle-orm';

export function withoutDeleted<T extends { deletedAt: any }>(
  table: T
): SQL {
  return isNull(table.deletedAt);
}

// Usage:
const ideas = await db.query.ideas.findMany({
  where: and(
    eq(ideas.userId, userId),
    withoutDeleted(ideas)
  ),
});
```

### 3. Pagination (Cursor-based)

**Cursor-based pagination (preferred for real-time feeds):**

```typescript
export async function getIdeasPaginated(
  userId: string,
  cursor?: string,
  limit: number = 20
) {
  return db.query.ideas.findMany({
    where: and(
      eq(ideas.userId, userId),
      cursor ? gt(ideas.id, cursor) : undefined
    ),
    limit: limit + 1, // Fetch one extra to check if there's more
    orderBy: [asc(ideas.position)],
  });
}

// Usage:
const results = await getIdeasPaginated(userId, cursor, 20);
const hasMore = results.length > 20;
const ideas = results.slice(0, 20);
const nextCursor = hasMore ? ideas[ideas.length - 1].id : null;
```

**Offset-based pagination (for static pages):**

```typescript
export async function getIdeasPage(
  userId: string,
  page: number,
  pageSize: number = 20
) {
  const offset = (page - 1) * pageSize;

  const [ideas, total] = await Promise.all([
    db.query.ideas.findMany({
      where: eq(ideas.userId, userId),
      limit: pageSize,
      offset,
      orderBy: [asc(ideas.position)],
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ideas)
      .where(eq(ideas.userId, userId))
      .then(([row]) => row.count),
  ]);

  return {
    ideas,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

### 4. Reordering (Drag-and-Drop)

**Update position after drag-and-drop:**

```typescript
export async function reorderIdeas(
  userId: string,
  ideaId: string,
  newPosition: number
) {
  const idea = await db.query.ideas.findFirst({
    where: and(eq(ideas.id, ideaId), eq(ideas.userId, userId)),
  });

  if (!idea) throw new Error('Idea not found');

  const oldPosition = idea.position;

  // Shift other ideas
  if (newPosition < oldPosition) {
    // Moving up: shift down ideas between new and old position
    await db.update(ideas)
      .set({ position: sql`${ideas.position} + 1` })
      .where(and(
        eq(ideas.userId, userId),
        gte(ideas.position, newPosition),
        lt(ideas.position, oldPosition)
      ));
  } else {
    // Moving down: shift up ideas between old and new position
    await db.update(ideas)
      .set({ position: sql`${ideas.position} - 1` })
      .where(and(
        eq(ideas.userId, userId),
        gt(ideas.position, oldPosition),
        lte(ideas.position, newPosition)
      ));
  }

  // Update dragged idea
  await db.update(ideas)
    .set({ position: newPosition })
    .where(eq(ideas.id, ideaId));
}
```

### 5. Bulk Operations

**Batch insert features:**

```typescript
export async function createFeaturesInBulk(
  ideaId: string,
  features: InsertIdeaFeature[]
) {
  // Get max position
  const maxPosition = await db
    .select({ max: sql<number>`COALESCE(MAX(${ideaFeatures.position}), -1)` })
    .from(ideaFeatures)
    .where(eq(ideaFeatures.ideaId, ideaId))
    .then(([row]) => row.max);

  // Assign positions
  const featuresWithPositions = features.map((feature, index) => ({
    ...feature,
    ideaId,
    position: maxPosition + index + 1,
  }));

  // Batch insert
  return db.insert(ideaFeatures).values(featuresWithPositions).returning();
}
```

### 6. Aggregations

**Count features by idea:**

```typescript
export async function getIdeasWithFeatureCounts(userId: string) {
  return db
    .select({
      id: ideas.id,
      title: ideas.title,
      featureCount: sql<number>`COUNT(${ideaFeatures.id})`,
      completedCount: sql<number>`COUNT(${ideaFeatures.completedAt})`,
    })
    .from(ideas)
    .leftJoin(ideaFeatures, eq(ideas.id, ideaFeatures.ideaId))
    .where(eq(ideas.userId, userId))
    .groupBy(ideas.id);
}
```

### 7. Full-Text Search (Future)

**Using Postgres tsvector:**

```sql
-- Migration: Add full-text search column
ALTER TABLE ideas ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B')
  ) STORED;

CREATE INDEX ideas_search_vector_idx ON ideas USING GIN(search_vector);
```

```typescript
// Search implementation
export async function searchIdeas(userId: string, query: string) {
  return db
    .select()
    .from(ideas)
    .where(and(
      eq(ideas.userId, userId),
      sql`${ideas.searchVector} @@ plainto_tsquery('english', ${query})`
    ))
    .orderBy(sql`ts_rank(${ideas.searchVector}, plainto_tsquery('english', ${query})) DESC`);
}
```

## Performance Optimization

### Indexing Strategy

**Current Indexes:**

```sql
-- Ideas
CREATE INDEX ideas_user_id_idx ON ideas(user_id);
CREATE INDEX ideas_position_idx ON ideas(user_id, position);
CREATE INDEX ideas_starred_idx ON ideas(user_id, starred) WHERE starred = true;
CREATE INDEX ideas_deleted_at_idx ON ideas(deleted_at) WHERE deleted_at IS NOT NULL;

-- Idea Features
CREATE INDEX idea_features_idea_id_idx ON idea_features(idea_id);
CREATE INDEX idea_features_position_idx ON idea_features(idea_id, position);

-- Dev Jobs
CREATE INDEX dev_jobs_idea_id_idx ON dev_jobs(idea_id);
CREATE INDEX dev_jobs_user_id_idx ON dev_jobs(user_id);
CREATE INDEX dev_jobs_status_idx ON dev_jobs(status);

-- Dev Logs
CREATE INDEX dev_logs_job_id_idx ON dev_logs(job_id);
CREATE INDEX dev_logs_timestamp_idx ON dev_logs(job_id, timestamp);
```

**Partial Indexes (Performance Boost):**

Partial indexes reduce index size and improve write performance:

```sql
-- Only index starred ideas (reduces index size by ~90%)
CREATE INDEX ideas_starred_idx ON ideas(user_id, starred)
WHERE starred = true;

-- Only index soft-deleted ideas (for cleanup queries)
CREATE INDEX ideas_deleted_at_idx ON ideas(deleted_at)
WHERE deleted_at IS NOT NULL;
```

### Connection Pooling

**Neon Serverless Driver:**

```typescript
// lib/db/index.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

neonConfig.fetchConnectionCache = true; // Enable HTTP fetch caching

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

**Benefits:**
- No persistent connections (perfect for serverless)
- Automatic connection pooling
- HTTP-based (works in edge environments)

### Query Optimization Tips

**1. Use `EXPLAIN ANALYZE` to debug slow queries:**

```bash
psql $DATABASE_URL -c "
  EXPLAIN ANALYZE
  SELECT * FROM ideas
  WHERE user_id = 'user123'
  ORDER BY position;
"
```

**2. Avoid SELECT *:**

```typescript
// Bad: Fetches all columns
const ideas = await db.select().from(ideas);

// Good: Only fetch needed columns
const ideas = await db.select({
  id: ideas.id,
  title: ideas.title,
}).from(ideas);
```

**3. Use prepared statements for repeated queries:**

```typescript
// Prepared statement (compiled once, executed many times)
const getIdeaById = db
  .select()
  .from(ideas)
  .where(eq(ideas.id, sql.placeholder('id')))
  .prepare('get_idea_by_id');

// Usage:
const idea1 = await getIdeaById.execute({ id: 'abc' });
const idea2 = await getIdeaById.execute({ id: 'def' });
```

## Data Integrity

### Cascading Deletes

```typescript
// When idea is deleted, features and jobs are automatically deleted
export const ideaFeatures = pgTable('idea_features', {
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id, { onDelete: 'cascade' }), // CASCADE
});

export const devJobs = pgTable('dev_jobs', {
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id, { onDelete: 'cascade' }), // CASCADE
});
```

### Constraints

**Unique constraints:**

```typescript
// Email must be unique
export const users = pgTable('users', {
  email: text('email').notNull().unique(),
});

// Pairing codes must be unique
export const devPairings = pgTable('dev_pairings', {
  pairingCode: text('pairing_code').notNull().unique(),
});
```

**Check constraints (future):**

```sql
-- Ensure position is non-negative
ALTER TABLE ideas ADD CONSTRAINT ideas_position_check
CHECK (position >= 0);

-- Ensure job status is valid
ALTER TABLE dev_jobs ADD CONSTRAINT dev_jobs_status_check
CHECK (status IN ('pending', 'running', 'completed', 'failed'));
```

## Backup & Recovery

### Neon Automatic Backups

**Configuration:**
- Point-in-time recovery (PITR) enabled by default
- 7-day retention on free tier
- Restore to any point in time

**Restore Process:**

```bash
# Create new branch from historical point
neon branches create --name restore-2025-10-30 \
  --parent main \
  --timestamp 2025-10-30T10:00:00Z

# Update DATABASE_URL to restored branch
DATABASE_URL="postgresql://...restore-2025-10-30..."
```

### Manual Backups

**Export entire database:**

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

**Export specific tables:**

```bash
pg_dump $DATABASE_URL -t ideas -t idea_features > ideas-backup.sql
```

**Import backup:**

```bash
psql $DATABASE_URL < backup-20251030.sql
```

## Monitoring & Observability

### Slow Query Log

**Enable in Neon dashboard:**
- Settings → Query Statistics → Enable
- Queries > 1s are logged

**Check slow queries:**

```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Database Size Monitoring

```sql
-- Total database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Connection Pool Metrics

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Connections by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- Long-running queries (> 1 minute)
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '1 minute';
```

## Future Enhancements

### 1. Read Replicas

**Use case:** Offload read queries from primary database

```typescript
// lib/db/index.ts
const primaryUrl = process.env.DATABASE_URL!;
const replicaUrl = process.env.DATABASE_REPLICA_URL!;

export const dbPrimary = drizzle(postgres(primaryUrl));
export const dbReplica = drizzle(postgres(replicaUrl));

// Read from replica
const ideas = await dbReplica.query.ideas.findMany();

// Write to primary
await dbPrimary.insert(ideas).values({ ... });
```

### 2. Database Sharding

**Use case:** Distribute users across multiple databases

```typescript
// lib/db/shard.ts
function getShardForUser(userId: string): Database {
  const shardIndex = hashCode(userId) % SHARD_COUNT;
  return shards[shardIndex];
}

const db = getShardForUser(userId);
const ideas = await db.query.ideas.findMany({ ... });
```

### 3. Change Data Capture (CDC)

**Use case:** Stream database changes to external systems

```sql
-- Enable logical replication
ALTER TABLE ideas REPLICA IDENTITY FULL;

-- Create publication
CREATE PUBLICATION coda_changes FOR TABLE ideas, idea_features;
```

```typescript
// Subscribe to changes (using Debezium/Kafka)
kafkaConsumer.on('message', (message) => {
  const change = JSON.parse(message.value);
  if (change.op === 'c') {
    console.log('New idea created:', change.after);
  }
});
```

---

**Related Documents:**
- `01-architecture-deep-dive.md` - Overall system architecture
- `02-development-workflow.md` - Migration workflow
- `03-devmode-runner-spec.md` - Dev Mode schema usage
- `05-operations-deployment.md` - Production database management
