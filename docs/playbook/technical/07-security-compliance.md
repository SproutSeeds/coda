# Security & Compliance Technical Guide

## Executive Summary

This document outlines Coda's security architecture, threat models, compliance requirements, and security best practices for development and operations teams.

## Security Architecture Overview

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                                       │
│ - HTTPS/TLS 1.3 everywhere                                      │
│ - Vercel WAF (Web Application Firewall)                         │
│ - DDoS protection (Vercel)                                      │
└─────────────────────────────────────────────────────────────────┘
         │
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Application Security                                   │
│ - CSRF protection (Auth.js double-submit cookies)               │
│ - XSS prevention (React auto-escaping)                          │
│ - SQL injection prevention (Drizzle parameterized queries)      │
│ - Rate limiting (Upstash)                                       │
└─────────────────────────────────────────────────────────────────┘
         │
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Authentication & Authorization                         │
│ - Auth.js (NextAuth.js) - email + password                     │
│ - JWT-based sessions (HTTP-only cookies)                        │
│ - Role-based access control (RBAC)                              │
└─────────────────────────────────────────────────────────────────┘
         │
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: Data Security                                          │
│ - Encryption at rest (Postgres AES-256)                         │
│ - Encryption in transit (TLS 1.3)                               │
│ - Soft delete with undo (7-day recovery)                        │
│ - Database backups (Neon automatic)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### Auth.js (NextAuth.js) Implementation

**Configuration:**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db),
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      maxAge: 24 * 60 * 60, // Magic link valid for 24 hours
    }),
    CredentialsProvider({
      name: 'Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
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
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### Password Security

**Hashing:**

```typescript
// lib/auth/password.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 12; // Recommended for 2025
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Password Requirements:**

```typescript
// lib/validations/password.ts
import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain special character');
```

### Session Management

**JWT Configuration:**

```typescript
// JWT payload structure
{
  "id": "user-uuid",
  "email": "user@example.com",
  "iat": 1698765432,  // Issued at
  "exp": 1701357432,  // Expires at (30 days)
  "jti": "random-jti" // JWT ID (for revocation)
}
```

**Session Security:**
- HTTP-only cookies (prevents XSS theft)
- SameSite=Lax (prevents CSRF)
- Secure flag in production (HTTPS only)
- Short-lived access tokens (30 days)
- Session refresh on activity (every 24 hours)

### Authorization Patterns

**Server Action Authorization:**

```typescript
// app/dashboard/ideas/actions/index.ts
'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function updateIdea(data: UpdateIdeaInput) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // 2. Authorize (check ownership)
  const idea = await db.query.ideas.findFirst({
    where: eq(ideas.id, data.id),
  });

  if (!idea || idea.userId !== session.user.id) {
    return { success: false, error: 'Forbidden' };
  }

  // 3. Proceed with update
  // ...
}
```

**API Route Authorization:**

```typescript
// app/api/devmode/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyJWT(token);

  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Proceed with authorized logic
  // ...
}
```

## Input Validation & Sanitization

### Zod Schema Validation

**Server Action Validation:**

```typescript
// app/dashboard/ideas/actions/index.ts
'use server'

import { createIdeaSchema } from '@/lib/validations/ideas';

export async function createIdea(data: unknown) {
  // Validate input
  const result = createIdeaSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: 'Invalid input',
      details: result.error.flatten(),
    };
  }

  // Proceed with validated data
  const validated = result.data;
  // ...
}
```

### XSS Prevention

**React Auto-Escaping:**

React automatically escapes HTML in JSX:

```typescript
// Safe: React escapes HTML entities
<div>{userInput}</div>

// Unsafe: Bypasses escaping (avoid unless necessary)
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Sanitize Rich Text (if needed):**

```typescript
import DOMPurify from 'isomorphic-dompurify';

const cleanHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target'],
});
```

### SQL Injection Prevention

**Drizzle Parameterized Queries:**

```typescript
// Safe: Drizzle uses parameterized queries
const ideas = await db.query.ideas.findMany({
  where: eq(ideas.userId, userId), // Automatically parameterized
});

// Safe: Manual query with parameters
const result = await db.execute(sql`
  SELECT * FROM ideas
  WHERE user_id = ${userId}
  AND title LIKE ${searchTerm}
`);

// NEVER do this (vulnerable to SQL injection):
// const result = await db.execute(sql`
//   SELECT * FROM ideas WHERE title = '${userInput}'
// `);
```

## Rate Limiting

### Upstash Rate Limiting

**Configuration:**

```typescript
// lib/utils/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Authentication endpoints
export const authRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'), // 5 attempts per 10 minutes
  analytics: true,
  prefix: 'ratelimit:auth',
});

// Email sending
export const emailRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '5 m'), // 3 emails per 5 minutes
  analytics: true,
  prefix: 'ratelimit:email',
});

// General API
export const apiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 requests per minute
  analytics: true,
  prefix: 'ratelimit:api',
});
```

**Usage:**

```typescript
// app/dashboard/ideas/actions/index.ts
import { apiRateLimit } from '@/lib/utils/ratelimit';

export async function createIdea(data: CreateIdeaInput) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // Rate limit check
  const { success: rateLimitOk } = await apiRateLimit.limit(session.user.id);

  if (!rateLimitOk) {
    return { success: false, error: 'Rate limit exceeded. Please try again later.' };
  }

  // Proceed with creation
  // ...
}
```

## Data Security

### Encryption

**At Rest (Database):**
- Vercel Postgres (Neon) uses AES-256 encryption
- Backups encrypted with same key
- Keys managed by Neon (no manual key management)

**In Transit (Network):**
- TLS 1.3 for all connections
- HTTPS enforced via Vercel
- WebSocket connections use WSS (TLS)

**Sensitive Data Handling:**

```typescript
// DO: Store password hashes, not passwords
const passwordHash = await bcrypt.hash(password, 12);
await db.insert(users).values({ email, passwordHash });

// DON'T: Store passwords in plain text
// await db.insert(users).values({ email, password }); // NEVER DO THIS

// DO: Use environment variables for secrets
const secret = process.env.JWT_SECRET;

// DON'T: Hardcode secrets
// const secret = 'hardcoded-secret'; // NEVER DO THIS
```

### Soft Delete & Data Retention

**Soft Delete Implementation:**

```typescript
// lib/db/actions/soft-delete.ts
export async function softDeleteIdea(ideaId: string, userId: string) {
  const undoToken = generateSecureToken(); // Crypto-random token
  const undoExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.update(ideas)
    .set({
      deletedAt: new Date(),
      undoToken,
      undoExpiresAt,
    })
    .where(and(
      eq(ideas.id, ideaId),
      eq(ideas.userId, userId)
    ));

  return { undoToken, expiresAt: undoExpiresAt };
}
```

**Permanent Deletion (Cron Job):**

```typescript
// app/api/cron/purge-soft-deletes/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete ideas with expired undo tokens
  const result = await db.delete(ideas)
    .where(and(
      isNotNull(ideas.deletedAt),
      lt(ideas.undoExpiresAt, new Date())
    ));

  return NextResponse.json({ deleted: result.rowCount });
}
```

### Data Backup Strategy

**Neon Automatic Backups:**
- Continuous point-in-time recovery (PITR)
- 7-day retention on free tier, 30 days on paid
- No manual backup configuration needed

**Manual Exports (Optional):**

```bash
# Export entire database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup-20251030.sql

# Upload to S3 (optional)
aws s3 cp backup-20251030.sql.gpg s3://coda-backups/
```

## CORS & CSRF Protection

### CORS Configuration

```typescript
// middleware.ts (if needed for API routes)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://app.coda.com',
    'https://staging.coda.com',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  return NextResponse.next();
}
```

### CSRF Protection

**Auth.js Built-in CSRF:**
- Double-submit cookie pattern
- CSRF token validated on every POST request
- Automatic protection for Auth.js routes

**Custom CSRF Token (if needed):**

```typescript
// lib/csrf.ts
import { randomBytes } from 'crypto';

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

export function verifyCSRFToken(token: string, expected: string): boolean {
  return token === expected;
}
```

## DevMode Security

### Runner Pairing Security

**Pairing Code Generation:**

```typescript
// app/api/devmode/pair/request/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { runnerType, runnerVersion, hostname } = body;

  // Generate 6-digit pairing code
  const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
  const pairingJti = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.insert(devPairings).values({
    userId: session.user.id,
    pairingCode,
    pairingJti,
    expiresAt,
    runnerType,
    runnerVersion,
    hostname,
  });

  return NextResponse.json({
    pairingCode,
    expiresAt,
    pollUrl: `/api/devmode/pair/status/${pairingJti}`,
  });
}
```

**Token Issuance:**

```typescript
// app/api/devmode/pair/approve/route.ts
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pairingCode } = body;

  // Verify pairing code
  const pairing = await db.query.devPairings.findFirst({
    where: and(
      eq(devPairings.pairingCode, pairingCode),
      gt(devPairings.expiresAt, new Date()),
      isNull(devPairings.approvedAt)
    ),
  });

  if (!pairing) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  // Mark as approved
  await db.update(devPairings)
    .set({ approvedAt: new Date() })
    .where(eq(devPairings.id, pairing.id));

  // Issue JWT token
  const token = jwt.sign(
    {
      userId: pairing.userId,
      type: 'runner',
      pairingId: pairing.id,
    },
    process.env.DEVMODE_JWT_SECRET!,
    { expiresIn: '30d' }
  );

  return NextResponse.json({ token, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
}
```

### Relay Security

**Token Verification:**

```typescript
// relay/index.ts
import jwt from 'jsonwebtoken';

wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ws.close(4001, 'Missing authorization token');
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    ws.close(4001, 'Invalid token');
    return;
  }

  // Proceed with connection
  // ...
});
```

## Security Headers

### Content Security Policy (CSP)

```typescript
// next.config.js
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' https://*.vercel.com wss://*.fly.dev https://*.upstash.io;
  frame-ancestors 'none';
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

## Compliance

### GDPR Compliance

**Data Subject Rights:**

1. **Right to Access:**
   ```typescript
   // Export all user data
   export async function exportUserData(userId: string) {
     const userData = await db.query.users.findFirst({
       where: eq(users.id, userId),
       with: {
         ideas: { with: { features: true } },
         devJobs: { with: { logs: true } },
       },
     });

     return userData;
   }
   ```

2. **Right to Erasure:**
   ```typescript
   // Permanently delete user and all associated data
   export async function deleteUserData(userId: string) {
     // Delete cascades to ideas, features, jobs, logs
     await db.delete(users).where(eq(users.id, userId));
   }
   ```

3. **Right to Portability:**
   - JSON export feature (already implemented)
   - Standardized format (see `docs/idea-import-export-schema.json`)

### Data Retention Policy

**Retention Periods:**

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| Active user accounts | Indefinite | Until user deletes account |
| Soft-deleted ideas | 7 days | Allow undo, then purge |
| Dev Mode logs | 30 days | Debugging, then purge |
| Audit logs (future) | 1 year | Compliance requirements |
| Expired pairing codes | 24 hours | Cleanup after expiration |

**Automated Purging:**

```typescript
// app/api/cron/cleanup/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Purge soft-deleted ideas > 7 days
  const deletedIdeas = await db.delete(ideas).where(
    and(isNotNull(ideas.deletedAt), lt(ideas.undoExpiresAt, new Date()))
  );

  // Purge old logs > 30 days
  const deletedLogs = await db.delete(devLogs).where(
    lt(devLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  );

  // Purge expired pairings > 24 hours
  const deletedPairings = await db.delete(devPairings).where(
    lt(devPairings.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
  );

  return NextResponse.json({
    deletedIdeas: deletedIdeas.rowCount,
    deletedLogs: deletedLogs.rowCount,
    deletedPairings: deletedPairings.rowCount,
  });
}
```

## Security Monitoring

### Error Tracking (Future: Sentry)

**Capture Security Events:**

```typescript
import * as Sentry from '@sentry/nextjs';

// Failed login attempt
Sentry.captureMessage('Failed login attempt', {
  level: 'warning',
  tags: { security: 'auth' },
  user: { email: attemptedEmail },
});

// Rate limit exceeded
Sentry.captureMessage('Rate limit exceeded', {
  level: 'info',
  tags: { security: 'ratelimit' },
  user: { id: userId },
});

// Suspicious activity
Sentry.captureMessage('Suspicious SQL query detected', {
  level: 'critical',
  tags: { security: 'sqli-attempt' },
  extra: { query: sanitizedQuery },
});
```

### Security Audit Log (Future)

```typescript
// lib/audit/security.ts
export async function logSecurityEvent(
  type: SecurityEventType,
  userId: string,
  details: object
) {
  await db.insert(securityAuditLogs).values({
    type,
    userId,
    ipAddress: getClientIp(),
    userAgent: getUserAgent(),
    details,
    timestamp: new Date(),
  });

  // Alert on critical events
  if (type === 'SUSPICIOUS_ACTIVITY') {
    await sendSecurityAlert(details);
  }
}
```

## Incident Response

### Security Incident Runbook

**1. Identify:**
- Monitor Sentry for security alerts
- Check rate limit violations
- Review authentication failures

**2. Contain:**
- Revoke compromised tokens
- Ban suspicious IPs (Vercel WAF)
- Disable affected accounts

**3. Eradicate:**
- Patch vulnerability
- Update dependencies
- Deploy fix

**4. Recover:**
- Restore from backup (if data loss)
- Notify affected users
- Reset credentials (if needed)

**5. Lessons Learned:**
- Document incident
- Update security procedures
- Implement preventive measures

---

**Related Documents:**
- `01-architecture-deep-dive.md` - Security architecture
- `05-operations-deployment.md` - Secret management
- `06-testing-qa-strategy.md` - Security testing
