# Technical Architecture Deep Dive

## Executive Summary

Coda's architecture is built on a foundation of modern web standards and production-proven patterns. This document provides a senior-level technical analysis of architectural decisions, trade-offs, and implementation patterns that power the platform.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel Edge Network                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            Next.js 15 App Router Layer                  │    │
│  │  - Server Components (RSC)                              │    │
│  │  - Server Actions (mutations)                           │    │
│  │  - Route Handlers (REST API)                            │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Postgres   │    │ Upstash Redis│    │  Auth.js     │
│   (Neon/     │    │ (Rate Limit) │    │  Sessions    │
│   Vercel)    │    └──────────────┘    └──────────────┘
└──────────────┘
         ▲
         │
┌─────────────────────────────────────────────────────────────────┐
│                  Desktop Runner Ecosystem                        │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │   Electron   │◄──WS────┤ Relay Server │                     │
│  │   Desktop    │         │  (Fly.io)    │                     │
│  │   Helper     │         └──────────────┘                     │
│  └──────────────┘                │                              │
│         │                         │                              │
│         ▼                         ▼                              │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │  node-pty    │         │    tmux      │                     │
│  │  Terminal    │         │   Sessions   │                     │
│  └──────────────┘         └──────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Technology Stack Analysis

### Next.js 15 (App Router) - Rationale & Benefits

**Why App Router over Pages Router:**
1. **Server Components by default**: Reduces client-side JavaScript bundle by ~40% for typical dashboard views
2. **Streaming SSR**: Progressive page rendering improves perceived performance (LCP improvements of 20-30%)
3. **Colocation**: Server Actions eliminate the API route middleman for mutations, reducing round-trip latency
4. **React 19 concurrency**: Native support for Suspense boundaries and transitions

**Implementation Pattern:**
```typescript
// app/dashboard/ideas/actions/index.ts
'use server'

export async function updateIdea(data: UpdateIdeaInput) {
  // Validation
  const validated = updateIdeaSchema.parse(data);

  // Rate limiting (Upstash)
  const { success } = await ratelimit.limit(userId);
  if (!success) throw new Error('Rate limit exceeded');

  // Database mutation
  const result = await db.update(ideas)
    .set(validated)
    .where(eq(ideas.id, validated.id));

  // Revalidation
  revalidatePath('/dashboard/ideas');

  return { success: true, data: result };
}
```

**Hydration Strategy:**
- Server Components for static content (idea cards, feature lists)
- Client Components only for interactive elements (drag-and-drop, terminals)
- Lazy loading for heavy components (xterm.js, Monaco editor)

**Learned Lessons:**
- **Commit `612593b`**: Fixed hydration mismatches by ensuring legal doc loading happens server-side only
- **Commit `0851b02`**: Tightened server/client boundaries to eliminate flicker during navigation

### Drizzle ORM - Type-Safe SQL Without Magic

**Why Drizzle over Prisma/TypeORM:**
1. **Zero-overhead types**: Schema definitions are TypeScript, not DSL
2. **SQL-first**: Generates predictable SQL, no hidden N+1 queries
3. **Migration control**: Explicit migration files, no auto-sync footguns
4. **Bundle size**: ~10KB vs Prisma's ~300KB client

**Schema Pattern:**
```typescript
// lib/db/schema.ts
export const ideas = pgTable('ideas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  notes: text('notes'),
  position: integer('position').notNull(),
  starred: boolean('starred').default(false),
  superStarred: boolean('super_starred').default(false),
  deletedAt: timestamp('deleted_at'),
  undoToken: text('undo_token'),
  undoExpiresAt: timestamp('undo_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const ideasRelations = relations(ideas, ({ many, one }) => ({
  features: many(ideaFeatures),
  user: one(users, {
    fields: [ideas.userId],
    references: [users.id],
  }),
}));
```

**Validation Integration (drizzle-zod):**
```typescript
// lib/validations/ideas.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const insertIdeaSchema = createInsertSchema(ideas, {
  title: z.string().min(1).max(200),
  notes: z.string().max(10000).optional(),
  position: z.number().int().nonnegative(),
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
```

**Migration Workflow:**
1. Modify `lib/db/schema.ts`
2. Run `pnpm db:generate` → creates SQL migration in `drizzle/migrations/`
3. Review generated SQL (Drizzle doesn't always detect renames correctly)
4. Run `pnpm db:migrate` against dev database
5. Commit schema + migration together
6. Production migrations run in postbuild (see `package.json`)

**Critical Migrations:**
- **Commit `9e04a8c`**: Added Dev Mode tables (`dev_jobs`, `dev_pairings`, `dev_logs`)
- **Commit `62556ee`**: Added log batching fields for performance

### Upstash Redis - Serverless Rate Limiting

**Why Upstash over self-hosted Redis:**
1. **Serverless model**: Pay per request, no idle connection costs
2. **Regional replication**: Data close to Vercel edge functions
3. **REST API**: Works in serverless environments (no persistent connections)
4. **Built-in rate limiting**: `@upstash/ratelimit` provides sliding window algorithms

**Implementation:**
```typescript
// lib/utils/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'coda:ratelimit',
});
```

**Applied Limits:**
- Login attempts: 5 per 10 minutes
- Email sends: 3 per 5 minutes
- Idea mutations: 50 per minute
- Feature reordering: 100 per minute (drag-and-drop heavy)

**Cost Analysis:**
- Free tier: 10,000 commands/day
- Current usage: ~2,000 commands/day (well within limits)
- Projected at 1,000 users: ~50,000 commands/day → $10/month

### Vercel Hosting - Deployment & Operations

**Why Vercel over AWS/GCP:**
1. **Zero-config Next.js**: Automatic build optimization, edge caching
2. **Preview deployments**: Every branch gets a unique URL
3. **Cron jobs**: Native support via `vercel.json`
4. **Analytics**: Built-in Web Vitals tracking
5. **Postgres integration**: Vercel Postgres (Neon under the hood)

**Deployment Pipeline:**
1. Push to feature branch → Vercel builds preview
2. Run E2E tests against preview URL
3. Merge to main → production deployment
4. Vercel automatically runs build, migrations, and revalidation

**Cron Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/purge-soft-deletes",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Environment Variables (Production):**
- `DATABASE_URL`: Vercel Postgres connection string
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: Rate limiting
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`: Auth.js configuration
- `EMAIL_SERVER`, `EMAIL_FROM`: Email provider (Resend/SendGrid)
- `DEVMODE_JWT_SECRET`: Runner authentication
- `NEXT_PUBLIC_DEVMODE_RELAY_URL`: WebSocket relay endpoint
- `CRON_SECRET`: Authorization for cron endpoints

## Frontend Architecture

### Component Architecture

**Hierarchy:**
```
Page (Server Component)
├── Layout (Server Component)
│   ├── Navigation (Client Component - has interactivity)
│   └── Analytics (Client Component - tracks events)
└── Content (Server Component)
    ├── IdeaList (Server Component - data fetching)
    │   └── IdeaCard (Client Component - drag-and-drop)
    │       └── FeatureList (Server Component)
    │           └── FeatureCard (Client Component - collapsible)
    └── TerminalDock (Client Component - xterm.js)
```

**Key Patterns:**
1. **Data fetching in Server Components**: Eliminates client-side loading states
2. **Client Components for interactivity**: Drag-and-drop, terminals, forms
3. **Optimistic updates**: Mutations update UI immediately, rollback on error
4. **Progressive enhancement**: Core functionality works without JavaScript

**Example: Optimistic Idea Deletion**
```typescript
// app/dashboard/ideas/components/IdeaCard.tsx
'use client'

function IdeaCard({ idea }: { idea: Idea }) {
  const [optimisticDeleted, setOptimisticDeleted] = useState(false);

  const handleDelete = async () => {
    setOptimisticDeleted(true);

    const result = await deleteIdea(idea.id);

    if (!result.success) {
      setOptimisticDeleted(false);
      toast.error('Failed to delete idea');
    } else {
      toast.success('Idea deleted. Undo available for 7 days.');
    }
  };

  if (optimisticDeleted) return null;

  return (
    <div className="idea-card">
      {/* ... */}
    </div>
  );
}
```

### State Management Strategy

**No global state library (Redux, Zustand, etc.):**
- Server Components handle most data fetching
- React Context for theme, user session (minimal)
- URL state for filters, sorting (searchParams)
- Optimistic UI via `useOptimistic` hook (React 19)

**Example: URL-based filtering**
```typescript
// app/dashboard/ideas/page.tsx (Server Component)
export default async function IdeasPage({
  searchParams,
}: {
  searchParams: { filter?: string; sort?: string };
}) {
  const ideas = await db.query.ideas.findMany({
    where: searchParams.filter === 'starred'
      ? eq(ideas.starred, true)
      : undefined,
    orderBy: searchParams.sort === 'updated'
      ? desc(ideas.updatedAt)
      : asc(ideas.position),
  });

  return <IdeaList ideas={ideas} />;
}
```

### Styling Architecture

**Tailwind + shadcn/ui Pattern:**
1. **Utility-first CSS**: Tailwind for rapid development
2. **Component library**: shadcn/ui for primitives (Button, Dialog, etc.)
3. **CSS variables**: Theme tokens in `app/globals.css`
4. **Design system**: Documented in `docs/design-system.md` (if exists)

**Interactive Button Pattern:**
```typescript
// components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**Motion Design:**
- Framer Motion for animations
- Max duration: 200ms (respects `prefers-reduced-motion`)
- Collapsible sections use `AnimatePresence`

```typescript
<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {content}
    </motion.div>
  )}
</AnimatePresence>
```

## Backend Architecture

### API Design Patterns

**Server Actions for Mutations:**
```typescript
// app/dashboard/ideas/actions/index.ts
'use server'

export async function createIdea(data: CreateIdeaInput) {
  // 1. Authentication check
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // 2. Input validation
  const validated = createIdeaSchema.parse(data);

  // 3. Rate limiting
  const { success: rateLimitOk } = await ratelimit.limit(session.user.id);
  if (!rateLimitOk) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  // 4. Database mutation
  const [newIdea] = await db.insert(ideas)
    .values({
      ...validated,
      userId: session.user.id,
      position: await getMaxPosition(session.user.id) + 1,
    })
    .returning();

  // 5. Cache revalidation
  revalidatePath('/dashboard/ideas');

  // 6. Analytics tracking
  await trackEvent('idea_created', { ideaId: newIdea.id });

  return { success: true, data: newIdea };
}
```

**Route Handlers for REST API:**
```typescript
// app/api/devmode/jobs/route.ts
export async function POST(request: Request) {
  // 1. Bearer token authentication
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const decoded = verifyJWT(token);

  // 2. Parse request body
  const body = await request.json();
  const validated = createJobSchema.parse(body);

  // 3. Business logic
  const job = await createJob(validated);

  // 4. Return JSON response
  return NextResponse.json(job, { status: 201 });
}
```

### Database Schema Design

**Normalized Schema:**
```sql
-- Core entities
users (id, email, name, created_at)
ideas (id, user_id, title, notes, position, starred, super_starred, deleted_at, undo_token, undo_expires_at)
idea_features (id, idea_id, title, notes, detail, detail_sections, position, starred, completed_at)

-- Auth.js tables
accounts (id, user_id, provider, provider_account_id, ...)
sessions (id, user_id, session_token, expires)
verification_tokens (identifier, token, expires)

-- Dev Mode
dev_jobs (id, idea_id, user_id, status, command, created_at)
dev_logs (id, job_id, level, message, timestamp)
dev_pairings (id, user_id, pairing_code, pairing_jti, approved_at, expires_at)
```

**Indexing Strategy:**
```sql
-- Performance-critical indexes
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_position ON ideas(user_id, position);
CREATE INDEX idx_ideas_starred ON ideas(user_id, starred) WHERE starred = true;
CREATE INDEX idx_ideas_deleted ON ideas(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_idea_features_idea_id ON idea_features(idea_id);
CREATE INDEX idx_idea_features_position ON idea_features(idea_id, position);

CREATE INDEX idx_dev_logs_job_id ON dev_logs(job_id);
CREATE INDEX idx_dev_logs_timestamp ON dev_logs(job_id, timestamp);
```

**Soft Delete Pattern:**
```typescript
// Soft delete with undo token
export async function deleteIdea(ideaId: string) {
  const undoToken = generateSecureToken();
  const undoExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.update(ideas)
    .set({
      deletedAt: new Date(),
      undoToken,
      undoExpiresAt,
    })
    .where(eq(ideas.id, ideaId));

  return { undoToken, expiresAt: undoExpiresAt };
}

// Undo deletion
export async function undoDeleteIdea(undoToken: string) {
  const [idea] = await db.update(ideas)
    .set({
      deletedAt: null,
      undoToken: null,
      undoExpiresAt: null,
    })
    .where(and(
      eq(ideas.undoToken, undoToken),
      gt(ideas.undoExpiresAt, new Date())
    ))
    .returning();

  if (!idea) throw new Error('Undo token invalid or expired');
  return idea;
}
```

### Authentication Architecture

**Auth.js Configuration:**
```typescript
// app/api/auth/[...nextauth]/route.ts
import { DrizzleAdapter } from '@auth/drizzle-adapter';

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db),
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    CredentialsProvider({
      name: 'Password',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Custom password validation logic
        const user = await validateUserPassword(credentials);
        return user;
      }
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
};
```

**Session Management:**
- JWT-based sessions (stateless)
- Stored in HTTP-only cookies
- 30-day expiration, sliding window
- CSRF protection via Auth.js built-ins

## Performance Optimizations

### Server-Side Rendering Strategy

**Streaming SSR:**
```typescript
// app/dashboard/ideas/[id]/page.tsx
export default async function IdeaDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<IdeaHeaderSkeleton />}>
        <IdeaHeader id={params.id} />
      </Suspense>

      <Suspense fallback={<FeatureListSkeleton />}>
        <FeatureList ideaId={params.id} />
      </Suspense>

      <Suspense fallback={<TerminalDockSkeleton />}>
        <TerminalDock ideaId={params.id} />
      </Suspense>
    </div>
  );
}
```

**Benefits:**
- Initial HTML rendered immediately
- Heavy components stream in progressively
- User sees content faster (improved LCP)

### Database Query Optimization

**N+1 Prevention:**
```typescript
// Bad: N+1 query
const ideas = await db.query.ideas.findMany();
for (const idea of ideas) {
  const features = await db.query.ideaFeatures.findMany({
    where: eq(ideaFeatures.ideaId, idea.id),
  });
}

// Good: Single query with relations
const ideas = await db.query.ideas.findMany({
  with: {
    features: true,
  },
});
```

**Pagination:**
```typescript
// Cursor-based pagination for infinite scroll
export async function getIdeas(cursor?: string, limit = 20) {
  return db.query.ideas.findMany({
    where: cursor ? gt(ideas.id, cursor) : undefined,
    limit: limit + 1, // Fetch one extra to check if there's more
    orderBy: asc(ideas.position),
  });
}
```

### Caching Strategy

**Next.js Cache Layers:**
1. **Full Route Cache**: Static pages cached at build time
2. **Router Cache**: Client-side navigation cache
3. **Data Cache**: `fetch()` responses cached (not applicable with Drizzle)
4. **React Cache**: Deduplicates requests within a render

**Custom Cache Invalidation:**
```typescript
import { revalidatePath, revalidateTag } from 'next/cache';

// Invalidate specific path
revalidatePath('/dashboard/ideas');

// Invalidate by tag (if using fetch with next: { tags: ['ideas'] })
revalidateTag('ideas');
```

## Scalability Considerations

### Current Bottlenecks (< 1,000 users)
1. **Database connections**: Neon pooler handles up to 10,000 connections
2. **Vercel function duration**: 10s limit (hobby), 60s (pro)
3. **Upstash rate limits**: 10,000 commands/day free tier

### Scaling Roadmap (1,000 - 10,000 users)
1. **Database read replicas**: Neon supports read-only branches
2. **Redis caching**: Cache idea lists, feature counts
3. **CDN for static assets**: Already handled by Vercel
4. **Background job queue**: Upstash QStash for log processing

### Scaling Roadmap (10,000+ users)
1. **Sharding by user**: Multi-tenant database architecture
2. **Microservices**: Split Dev Mode runner coordination into separate service
3. **Message queue**: Kafka/RabbitMQ for terminal log ingestion
4. **Kubernetes**: Self-hosted infrastructure for cost optimization

## Monitoring & Observability

### Metrics Tracked
- **Web Vitals**: LCP, FID, CLS (via Vercel Analytics)
- **Database queries**: Slow query log (Neon dashboard)
- **API latency**: Response time distribution
- **Error rates**: 4xx, 5xx by endpoint

### Alerting Strategy (Future)
- Database connection pool exhaustion
- API error rate > 5%
- Upstash rate limit hit
- Disk space (Postgres)

## Security Architecture

See `07-security-compliance.md` for full details.

### Key Security Measures
1. **SQL injection prevention**: Drizzle parameterized queries
2. **XSS prevention**: React automatic escaping
3. **CSRF protection**: Auth.js double-submit cookies
4. **Rate limiting**: Upstash per-user limits
5. **Input validation**: Zod schemas on all inputs
6. **JWT signing**: HS256 for runner authentication
7. **Environment secrets**: Vercel encrypted environment variables

## Conclusion

Coda's architecture prioritizes:
1. **Developer experience**: Type safety, fast feedback loops
2. **Performance**: Streaming SSR, optimistic UI
3. **Scalability**: Serverless components, stateless design
4. **Maintainability**: Minimal abstractions, explicit over magic

**Key Architectural Principles:**
- Server-first rendering (App Router)
- Type-safe data layer (Drizzle + Zod)
- Stateless infrastructure (Vercel + Upstash)
- Progressive enhancement (works without JS)
- Explicit over implicit (no hidden magic)

**Technical Debt Tracker:**
- Migrate from JWT to short-lived access tokens + refresh tokens
- Add comprehensive error tracking (Sentry)
- Implement feature flags (LaunchDarkly/Statsig)
- Add real-time collaboration (Yjs/CRDTs)
- Optimize bundle size (next-bundle-analyzer)

---

**Related Documents:**
- `02-development-workflow.md` - Development practices and tooling
- `03-devmode-runner-spec.md` - Runner architecture details
- `04-data-layer-schema.md` - Database schema and migrations
- `05-operations-deployment.md` - Deployment and operations
