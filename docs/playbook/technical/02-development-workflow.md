# Development Workflow & Tooling Guide

## Executive Summary

This document details the development workflow, tooling, and best practices for Coda platform development. It covers branch strategy, spec-driven development, code review processes, and the complete development lifecycle from ideation to production deployment.

## Branch Strategy & Git Workflow

### Branch-First Development (CRITICAL)

**Rule: Never commit directly to `main`**

All work follows this flow:

```
specs/00X-feature/
    ├── plan.md          # Strategy document
    ├── tasks.md         # Checklist
    └── contracts/       # API specs

         ↓

feature/feature-name     # Create feature branch
    ├── Implement
    ├── Test locally
    ├── Push to remote
    ├── Vercel preview build
    └── Verify build passes

         ↓

main                     # Merge only after successful build
    ├── Production deployment
    └── Delete feature branch
```

### Branch Naming Conventions

**Format:** `<type>/<short-description>`

**Types:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `refactor/` - Code restructuring
- `docs/` - Documentation changes
- `test/` - Test additions/fixes
- `chore/` - Maintenance tasks

**Examples:**
```bash
feature/runner-terminal-sync
fix/hydration-meetup-error
refactor/extract-terminal-components
docs/update-deployment-guide
test/add-e2e-terminal-tests
chore/upgrade-next-15-5
```

### Complete Branch Workflow

#### 1. Starting a New Feature

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create feature branch from main
git checkout -b feature/terminal-resize-throttle

# Create spec directory
mkdir -p specs/010-terminal-resize-throttle
touch specs/010-terminal-resize-throttle/plan.md
touch specs/010-terminal-resize-throttle/tasks.md
```

#### 2. Development Cycle

```bash
# Make changes
vim app/dashboard/ideas/components/TerminalPane.tsx

# Run quality checks locally
pnpm lint
pnpm typecheck
pnpm test -- --run

# Commit with conventional format
git add -A
git commit -m "$(cat <<'EOF'
feat: Add terminal resize throttling to prevent firewall triggers

Implemented debounced resize handler that batches terminal dimension
updates every 500ms instead of on every resize event. This prevents
excessive WebSocket messages that trigger Cloudflare rate limits.

- Added useDebounce hook for resize events
- Updated TerminalPane to use throttled dimensions
- Added tests for debounce behavior

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

#### 3. Push and Preview

```bash
# Push feature branch to remote
git push origin feature/terminal-resize-throttle

# Vercel automatically creates preview deployment
# URL format: coda-<hash>-<team>.vercel.app

# Wait for build to complete (check GitHub/Vercel dashboard)
# Verify the following:
# 1. Build succeeds without errors
# 2. Type checking passes
# 3. Preview deployment is accessible
# 4. Feature works as expected in preview
```

#### 4. Merge to Main

```bash
# Only proceed if preview build passed!

# Switch to main and ensure it's up to date
git checkout main
git pull origin main

# Fast-forward merge (no merge commit)
git merge feature/terminal-resize-throttle --ff-only

# If fast-forward fails, rebase feature branch:
# git checkout feature/terminal-resize-throttle
# git rebase main
# git checkout main
# git merge feature/terminal-resize-throttle --ff-only

# Push to production
git push origin main

# Delete feature branch
git branch -d feature/terminal-resize-throttle
git push origin --delete feature/terminal-resize-throttle
```

#### 5. Verify Production Deployment

```bash
# Vercel automatically deploys main to production
# Monitor deployment in Vercel dashboard

# Verify production:
# 1. Check deployment logs for errors
# 2. Test feature on production URL
# 3. Monitor error tracking (if Sentry configured)
# 4. Check Web Vitals in Vercel Analytics
```

### Commit Message Format

**Structure:**
```
<type>: <short summary (50 chars max)>

<optional body: detailed explanation, breaking changes, context>

<optional footer: issue references, co-authors>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code restructuring without behavior change
- `test` - Test additions or fixes
- `chore` - Build process, dependency updates
- `perf` - Performance improvements
- `style` - Code style changes (formatting, whitespace)

**Examples:**

```
feat: Add JSON export functionality for ideas

Implemented export feature that serializes idea + features to JSON
with schema validation. Export includes metadata (version, timestamp)
and conforms to docs/idea-import-export-schema.json.

- Added exportIdea server action
- Created ExportButton component with download trigger
- Added Zod schema validation for export format
- Updated CLAUDE.md with export workflow

Closes #42

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix: Resolve hydration mismatch in legal document display

Legal docs were being loaded client-side, causing content mismatch
between server and client renders. Moved legal doc fetching to
server component and passed as props to eliminate hydration error.

Fixes #87

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Key Git History Commits (Learning from the Past)

**MVP Foundation:**
- `6be870f` - Initial idea/feature CRUD implementation
- `f6ee6d3` - Mobile responsiveness improvements
- `d5542b9` - Legal docs integration

**Dev Mode Evolution:**
- `0b6b640` (tag `V2.0_dmg_helper_app`) - First CLI runner release
- `42711fe` - Electron packaging begins
- `0bb9458` - Workspace dependency materialization for DMG builds
- `9d652d7` - Notarized macOS DMG with proper entitlements

**Reliability & Performance:**
- `62556ee` - Log batching to reduce database load
- `616484b` - Terminal resize throttling
- `54af461` - Session tracking improvements
- `3e078d9` - Log spam reduction (stdin suppression)
- `4a52066` - Runner polling frequency optimization

**Critical Fixes:**
- `612593b` - Hydration mismatch resolution
- `0851b02` - Server/client boundary tightening
- `9e04a8c` - Dev Mode migration parity fix

## Spec-Driven Development

### Specs Directory Structure

```
specs/
├── 001-build-a-lightweight/
│   ├── plan.md              # Strategic overview
│   ├── tasks.md             # Task checklist
│   └── contracts/
│       └── api-shapes.md    # API contracts
├── 002-devmode-runner/
│   ├── plan.md
│   ├── tasks.md
│   ├── research.md          # Investigation notes
│   └── contracts/
│       ├── relay-protocol.md
│       └── runner-api.md
└── 003-electron-helper/
    ├── plan.md
    ├── tasks.md
    └── contracts/
        └── ipc-protocol.md
```

### Spec Lifecycle

#### 1. Planning Phase

**Create Plan Document (`plan.md`):**

```markdown
# Feature: Terminal Resize Throttling

## Problem Statement
Terminal resize events trigger excessive WebSocket messages (100+/sec
during resize), causing Cloudflare rate limiting to block connections.

## Solution Approach
Implement debounced resize handler that batches terminal dimension
updates every 500ms.

## Constraints
- Must not introduce perceived lag in terminal responsiveness
- Should work across all terminal types (xterm.js, CLI)
- Must maintain compatibility with existing tmux sessions

## Technical Approach
1. Add useDebounce hook to TerminalPane component
2. Debounce terminal.onResize callback
3. Add integration test to verify throttling behavior

## Success Criteria
- Resize events reduced from 100+/sec to ~2/sec
- No Cloudflare rate limit errors in logs
- Terminal remains responsive during window resize
- E2E test passes for resize behavior

## Rollout Plan
1. Implement in dev environment
2. Test with Cloudflare tunnel enabled
3. Deploy to preview environment
4. Monitor for 24 hours
5. Roll out to production
```

#### 2. Task Breakdown (`tasks.md`)

```markdown
# Tasks: Terminal Resize Throttling

## Implementation
- [ ] Create useDebounce hook in `lib/hooks/useDebounce.ts`
- [ ] Add unit tests for useDebounce hook
- [ ] Update TerminalPane to use debounced resize
- [ ] Add integration test for resize throttling
- [ ] Update TerminalDock to propagate resize events

## Testing
- [ ] Manual test: Verify terminal resizes smoothly
- [ ] Manual test: Verify no rate limit errors in console
- [ ] E2E test: Terminal resize behavior
- [ ] Performance test: Measure WebSocket message rate

## Documentation
- [ ] Update CLAUDE.md with resize handling pattern
- [ ] Add ADR (Architecture Decision Record) for throttle value choice
- [ ] Update terminal troubleshooting guide

## Deployment
- [ ] Push to feature branch
- [ ] Verify Vercel preview build
- [ ] Manual QA on preview environment
- [ ] Merge to main
- [ ] Monitor production for 24 hours
```

#### 3. Contract Definition (Optional, for APIs)

**Example: `contracts/relay-protocol.md`**

```markdown
# Relay Protocol Contract

## WebSocket Connection

**Endpoint:** `wss://relay.example.com/terminal`

**Authentication:**
```json
{
  "type": "auth",
  "token": "jwt-token-here"
}
```

## Message Types

### Client → Server

**Resize Event:**
```json
{
  "type": "resize",
  "sessionId": "tmux-session-id",
  "cols": 80,
  "rows": 24
}
```

**Input Event:**
```json
{
  "type": "input",
  "sessionId": "tmux-session-id",
  "data": "ls -la\n"
}
```

### Server → Client

**Output Event:**
```json
{
  "type": "output",
  "sessionId": "tmux-session-id",
  "data": "file1.txt\nfile2.txt\n"
}
```

**Error Event:**
```json
{
  "type": "error",
  "code": "RATE_LIMIT",
  "message": "Too many messages"
}
```
```

### Marking Tasks Complete

**As you work:**
```bash
# Open tasks.md
vim specs/010-terminal-resize-throttle/tasks.md

# Mark completed tasks with [X]
# - [X] Create useDebounce hook
# - [X] Add unit tests for useDebounce hook
# - [ ] Update TerminalPane to use debounced resize (IN PROGRESS)

# Commit task progress
git add specs/010-terminal-resize-throttle/tasks.md
git commit -m "chore: Update task progress for terminal resize throttling"
```

**Upon feature completion:**
```bash
# Ensure all tasks marked [X]
# Update plan.md with "Status: Completed"
# Add "Completed: 2025-10-30" to plan.md

git add specs/010-terminal-resize-throttle/
git commit -m "docs: Mark terminal resize throttling feature complete"
```

## Local Development Environment

### Prerequisites

**Required Software:**
- Node.js 20+ (LTS)
- pnpm 8+
- Docker (for local Postgres, optional with Neon)
- tmux (for Dev Mode runner testing)
- Xcode Command Line Tools (macOS, for Electron builds)

**Installation:**
```bash
# Node.js (via nvm)
nvm install 20
nvm use 20

# pnpm
npm install -g pnpm

# Docker Desktop
# Download from docker.com

# tmux (macOS)
brew install tmux

# Xcode CLI Tools (macOS)
xcode-select --install
```

### Project Setup

```bash
# Clone repository
git clone https://github.com/yourusername/coda.git
cd coda

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Edit environment variables
vim .env.local
# Set DATABASE_URL, NEXTAUTH_SECRET, etc.

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables (Local Dev)

**Minimum Required:**
```env
# Database (choose one)
DATABASE_URL="postgresql://user:pass@localhost:5432/coda"  # Local Docker
# or
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/coda"  # Neon

# Auth.js
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Email (development mode)
EMAIL_SERVER="stream"  # Uses console logging
EMAIL_FROM="Coda Dev <dev@localhost>"

# Dev Mode (optional)
DEVMODE_JWT_SECRET="generate-another-secret"
NEXT_PUBLIC_DEVMODE_RELAY_URL="ws://localhost:8080"
```

**Optional (for full feature testing):**
```env
# Rate Limiting
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"

# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="xxx"

# Cron (for testing cron endpoints)
CRON_SECRET="local-cron-secret"
```

### Development Commands

#### Core Development

```bash
# Start Next.js dev server
pnpm dev
# → http://localhost:3000

# Run type checking (watch mode)
pnpm typecheck --watch

# Run linter (auto-fix)
pnpm lint --fix

# Format code
pnpm format
```

#### Database Operations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
# → http://localhost:4983

# Seed database (if seed script exists)
pnpm db:seed

# Reset database (drop + recreate)
pnpm db:reset
```

#### Testing

```bash
# Unit tests (Vitest)
pnpm test              # Watch mode
pnpm test -- --run     # Single run
pnpm test -- --coverage  # With coverage

# E2E tests (Playwright)
pnpm e2e               # Headless
pnpm e2e -- --ui       # Interactive UI
pnpm e2e -- --debug    # Debug mode
pnpm e2e -- --headed   # Show browser

# Performance tests (Lighthouse)
pnpm lighthouse        # Runs against dev server
```

#### Desktop App Development

```bash
# Run Electron app in dev mode
pnpm --filter @coda/runner-desktop dev
# Launches: Vite renderer + Electron main/preload + hot reload

# Build desktop app (local)
cd apps/runner-desktop
pnpm run package
# Output: dist/apps/runner-desktop/

# Generate icons (if icons changed)
pnpm generate:runner-icons
```

#### CLI Runner (Legacy)

```bash
# Build CLI runner
pnpm runner:build

# Run CLI runner
node dist/runner/devmode-runner.js

# Package CLI binaries
pnpm runner:pkg:mac-arm64
pnpm runner:pkg:mac-x64
pnpm runner:pkg:win-x64
pnpm runner:pkg:linux-x64
```

### IDE Configuration

#### VS Code Settings

**Recommended Extensions:**
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Prisma (for syntax highlighting, though we use Drizzle)
- GitLens
- Error Lens

**`.vscode/settings.json`:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

#### ESLint Configuration

**`.eslintrc.json`:**
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "react/no-unescaped-entities": "off"
  }
}
```

#### Prettier Configuration

**`.prettierrc`:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

## Code Review Process

### Pre-Review Checklist (Author)

Before requesting review:

- [ ] All linters pass (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test -- --run`)
- [ ] E2E tests pass for affected features (`pnpm e2e`)
- [ ] Vercel preview build succeeds
- [ ] Feature tested manually on preview URL
- [ ] CLAUDE.md updated (if architecture changed)
- [ ] Spec tasks marked complete
- [ ] Commit messages follow conventional format
- [ ] No console.log statements left in code
- [ ] No commented-out code blocks
- [ ] Screenshots/videos attached for UI changes

### Review Criteria (Reviewer)

**Code Quality:**
- Follows TypeScript best practices
- Proper error handling
- No unnecessary complexity
- Reuses existing utilities/components
- Type safety (no `any` unless necessary)

**Testing:**
- Critical paths covered by tests
- Edge cases considered
- Test names are descriptive

**Performance:**
- No obvious N+1 queries
- Images optimized (next/image)
- Large components lazy-loaded
- No blocking operations on main thread

**Security:**
- No hardcoded secrets
- Input validation present
- SQL injection prevention (parameterized queries)
- XSS prevention (proper escaping)

**Documentation:**
- Complex logic has comments
- Public APIs documented
- CLAUDE.md updated if needed

### Review Workflow

**GitHub Pull Request Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Preview URL
https://coda-xxx.vercel.app

## Screenshots
(if applicable)

## Checklist
- [ ] Linter passes
- [ ] Type checking passes
- [ ] Tests pass
- [ ] CLAUDE.md updated
- [ ] Spec tasks complete
```

**Review Turnaround:**
- Target: < 24 hours for standard PRs
- Urgent: < 4 hours (bug fixes, production issues)

## Debugging Workflows

### Common Issues & Solutions

#### Hydration Mismatches

**Symptoms:**
```
Warning: Text content did not match. Server: "foo" Client: "bar"
```

**Debug Steps:**
1. Check for client-only code in Server Components
2. Verify Date/Time formatting (timezone issues)
3. Look for randomness (Math.random(), uuid generation)
4. Ensure localStorage/sessionStorage only accessed in useEffect

**Solution Pattern:**
```typescript
'use client'

export function ClientOnlyComponent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton />; // Match server render
  }

  return <div>{clientOnlyData}</div>;
}
```

#### Database Connection Issues

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Debug Steps:**
1. Verify DATABASE_URL is set correctly
2. Check Docker container is running (`docker ps`)
3. Test connection with psql: `psql $DATABASE_URL`
4. Check Neon dashboard for connection limits

**Solution:**
```bash
# Restart Docker Postgres
docker-compose down
docker-compose up -d

# Or use Neon (easier for dev)
# Update .env.local with Neon connection string
```

#### Vercel Build Failures

**Symptoms:**
```
Error: Type error: Property 'foo' does not exist on type 'Bar'
```

**Debug Steps:**
1. Run `pnpm typecheck` locally
2. Ensure all dependencies are in package.json (not just devDependencies)
3. Check for environment variable mismatches
4. Verify Vercel Node.js version matches local

**Solution:**
```bash
# Reproduce build locally
pnpm run build

# Check for missing env vars in Vercel dashboard
# Ensure all NEXT_PUBLIC_* vars are set
```

#### Rate Limiting Errors

**Symptoms:**
```
Error: Rate limit exceeded
```

**Debug Steps:**
1. Check Upstash dashboard for request count
2. Verify UPSTASH_REDIS_REST_TOKEN is correct
3. Look for retry loops in code
4. Check if multiple dev servers are running

**Solution:**
```typescript
// Add exponential backoff for retries
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Debugging Tools

**Next.js:**
```bash
# Enable verbose logging
DEBUG=* pnpm dev

# Analyze bundle size
pnpm run build
pnpm analyze  # If next-bundle-analyzer configured
```

**React DevTools:**
- Inspect component tree
- Check props/state
- Measure render performance
- Identify unnecessary re-renders

**Chrome DevTools:**
- Network tab: Check API response times
- Performance tab: Measure LCP, FID, CLS
- Console: Check for warnings/errors
- Application tab: Inspect cookies, localStorage

**Database:**
```bash
# Open Drizzle Studio
pnpm db:studio

# Run raw SQL query
psql $DATABASE_URL -c "SELECT * FROM ideas LIMIT 10;"

# Check slow queries (if pg_stat_statements enabled)
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

## Continuous Integration (Future)

### GitHub Actions Workflow (Planned)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm test -- --run --coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Performance Monitoring

### Local Performance Testing

```bash
# Run Lighthouse audit
pnpm lighthouse

# Results saved to evidence/ directory
cat evidence/lighthouse-report.json | jq '.categories'
```

**Target Metrics:**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- TTI (Time to Interactive): < 3.5s

### Production Monitoring (Vercel Analytics)

**Metrics Tracked:**
- Web Vitals (LCP, FID, CLS)
- Page load time
- API response time
- Error rates

**Access:**
- Vercel Dashboard → Project → Analytics
- Real-time metrics, 30-day retention

## Conclusion

**Key Workflow Principles:**
1. **Branch-first**: Always work on feature branches
2. **Spec-driven**: Plan before coding
3. **Test locally**: Ensure quality before pushing
4. **Preview builds**: Verify on Vercel before merging
5. **Conventional commits**: Maintain clean history
6. **Document changes**: Keep CLAUDE.md current

**Common Pitfalls to Avoid:**
- Pushing directly to main
- Skipping Vercel preview verification
- Merging without tests passing
- Forgetting to update specs/tasks
- Leaving console.log in production code
- Not testing database migrations

---

**Related Documents:**
- `01-architecture-deep-dive.md` - System architecture
- `03-devmode-runner-spec.md` - Runner development
- `04-data-layer-schema.md` - Database workflows
- `06-testing-qa-strategy.md` - Testing procedures
