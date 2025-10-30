# Testing Strategy & Quality Assurance

## Executive Summary

This document outlines Coda's comprehensive testing strategy, including unit tests (Vitest), E2E tests (Playwright), performance tests (Lighthouse), and quality assurance processes to ensure production reliability.

## Testing Pyramid

```
           ┌─────────────┐
          /   Manual QA   \      5% - Critical paths, UX validation
         ┌─────────────────┐
        /  E2E (Playwright)  \    15% - User flows, integration
       ┌─────────────────────┐
      /   Integration Tests   \   30% - API endpoints, DB queries
     ┌─────────────────────────┐
    /   Unit Tests (Vitest)     \  50% - Business logic, utilities
   └─────────────────────────────┘
```

## Unit Testing (Vitest)

### Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Test Examples

**1. Utility Functions:**

```typescript
// tests/unit/utils/autosave.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { renderHook, act } from '@testing-library/react';

describe('useDebounce', () => {
  it('should debounce value changes', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 1000),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current[0]).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current[0]).toBe('initial'); // Still old value

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current[0]).toBe('initial'); // Still old value

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current[0]).toBe('updated'); // Debounced value

    vi.useRealTimers();
  });
});
```

**2. Validation Schemas:**

```typescript
// tests/unit/validations/ideas.test.ts
import { describe, it, expect } from 'vitest';
import { insertIdeaSchema } from '@/lib/validations/ideas';

describe('insertIdeaSchema', () => {
  it('should validate correct idea data', () => {
    const validData = {
      userId: 'user123',
      title: 'Test Idea',
      notes: 'Some notes',
      position: 0,
    };

    const result = insertIdeaSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const invalidData = {
      userId: 'user123',
      title: '',
      position: 0,
    };

    const result = insertIdeaSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('Title required');
  });

  it('should reject title > 200 chars', () => {
    const invalidData = {
      userId: 'user123',
      title: 'a'.repeat(201),
      position: 0,
    };

    const result = insertIdeaSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

**3. Server Actions (Mocked):**

```typescript
// tests/unit/actions/ideas.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIdea } from '@/app/dashboard/ideas/actions';
import * as auth from 'next-auth/next';

vi.mock('next-auth/next');
vi.mock('@/lib/db');

describe('createIdea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create idea with valid data', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue({
      user: { id: 'user123', email: 'test@example.com' },
    } as any);

    const result = await createIdea({
      title: 'Test Idea',
      notes: 'Test notes',
      position: 0,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('id');
  });

  it('should reject unauthenticated request', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(null);

    const result = await createIdea({
      title: 'Test Idea',
      position: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
```

### Running Unit Tests

```bash
# Watch mode
pnpm test

# Single run with coverage
pnpm test -- --run --coverage

# Run specific test file
pnpm test -- ideas.test.ts

# Run tests matching pattern
pnpm test -- --grep "debounce"
```

## E2E Testing (Playwright)

### Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test Examples

**1. Authentication Flow:**

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login with email and password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard/ideas');
    await expect(page.locator('text=Ideas')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Logout');

    await expect(page).toHaveURL('/login');
  });
});
```

**2. Idea CRUD Operations:**

```typescript
// tests/e2e/ideas.spec.ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Ideas CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });

  test('should create new idea', async ({ page }) => {
    await page.goto('/dashboard/ideas');

    await page.click('button:has-text("New Idea")');
    await page.fill('input[name="title"]', 'Test E2E Idea');
    await page.fill('textarea[name="notes"]', 'Test notes');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Test E2E Idea')).toBeVisible();
  });

  test('should edit existing idea', async ({ page }) => {
    await page.goto('/dashboard/ideas');

    // Click first idea
    await page.click('.idea-card:first-child');

    // Edit title
    await page.fill('input[name="title"]', 'Updated Title');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Updated Title')).toBeVisible();
  });

  test('should delete idea with undo', async ({ page }) => {
    await page.goto('/dashboard/ideas');

    const ideaCard = page.locator('.idea-card:first-child');
    const ideaTitle = await ideaCard.locator('h3').textContent();

    // Delete idea
    await ideaCard.hover();
    await ideaCard.locator('button[aria-label="Delete"]').click();
    await page.click('button:has-text("Delete")'); // Confirm

    // Verify deletion
    await expect(page.locator(`text=${ideaTitle}`)).not.toBeVisible();

    // Undo deletion
    await page.click('button:has-text("Undo")');

    // Verify restoration
    await expect(page.locator(`text=${ideaTitle}`)).toBeVisible();
  });
});
```

**3. Drag-and-Drop:**

```typescript
// tests/e2e/drag-drop.spec.ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });

  test('should reorder ideas via drag and drop', async ({ page }) => {
    await page.goto('/dashboard/ideas');

    const firstIdea = page.locator('.idea-card:nth-child(1)');
    const secondIdea = page.locator('.idea-card:nth-child(2)');

    const firstTitle = await firstIdea.locator('h3').textContent();
    const secondTitle = await secondIdea.locator('h3').textContent();

    // Drag first idea to second position
    await firstIdea.hover();
    await page.mouse.down();
    await secondIdea.hover();
    await page.mouse.up();

    // Wait for animation
    await page.waitForTimeout(500);

    // Verify order changed
    const newFirstTitle = await page.locator('.idea-card:nth-child(1) h3').textContent();
    expect(newFirstTitle).toBe(secondTitle);
  });
});
```

**4. Export/Import:**

```typescript
// tests/e2e/export-import.spec.ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import fs from 'fs/promises';
import path from 'path';

test.describe('Export/Import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });

  test('should export idea as JSON', async ({ page }) => {
    await page.goto('/dashboard/ideas');
    await page.click('.idea-card:first-child');

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export JSON")'),
    ]);

    // Verify download
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/idea-.*\.json/);

    // Save and parse file
    const filePath = path.join(__dirname, 'downloads', fileName);
    await download.saveAs(filePath);

    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    expect(data).toHaveProperty('idea');
    expect(data).toHaveProperty('features');
  });

  test('should import idea from JSON', async ({ page }) => {
    await page.goto('/dashboard/ideas');

    // Upload JSON file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-idea.json'));

    await page.click('button:has-text("Import")');

    // Verify import
    await expect(page.locator('text=Imported Idea')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all tests
pnpm e2e

# Run with UI
pnpm e2e -- --ui

# Run specific test
pnpm e2e -- ideas.spec.ts

# Debug mode
pnpm e2e -- --debug

# Generate report
pnpm e2e -- --reporter=html
npx playwright show-report
```

## Performance Testing (Lighthouse)

### Setup

```javascript
// tests/perf/ideas-lighthouse.mjs
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'fs';

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

  const options = {
    logLevel: 'info',
    output: 'json',
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options);

  await chrome.kill();

  return runnerResult;
}

async function main() {
  const url = process.env.TEST_URL || 'http://localhost:3000';

  console.log(`Running Lighthouse audit on ${url}...`);

  const result = await runLighthouse(`${url}/dashboard/ideas`);

  // Extract scores
  const { categories } = result.lhr;
  const scores = {
    performance: categories.performance.score * 100,
    accessibility: categories.accessibility.score * 100,
    bestPractices: categories['best-practices'].score * 100,
    seo: categories.seo.score * 100,
  };

  console.log('\nLighthouse Scores:');
  console.log(`Performance: ${scores.performance}`);
  console.log(`Accessibility: ${scores.accessibility}`);
  console.log(`Best Practices: ${scores.bestPractices}`);
  console.log(`SEO: ${scores.seo}`);

  // Extract Web Vitals
  const audits = result.lhr.audits;
  const webVitals = {
    LCP: audits['largest-contentful-paint'].numericValue,
    FID: audits['max-potential-fid'].numericValue,
    CLS: audits['cumulative-layout-shift'].numericValue,
    TTI: audits['interactive'].numericValue,
  };

  console.log('\nWeb Vitals:');
  console.log(`LCP: ${webVitals.LCP}ms`);
  console.log(`FID: ${webVitals.FID}ms`);
  console.log(`CLS: ${webVitals.CLS}`);
  console.log(`TTI: ${webVitals.TTI}ms`);

  // Save report
  writeFileSync('evidence/lighthouse-report.json', JSON.stringify(result.lhr, null, 2));

  // Fail if performance < 90
  if (scores.performance < 90) {
    console.error('\n❌ Performance score below threshold (90)');
    process.exit(1);
  }

  console.log('\n✅ All performance checks passed');
}

main().catch(console.error);
```

### Performance Benchmarks

**Target Metrics:**

| Metric | Target | Warning | Failing |
|--------|--------|---------|---------|
| Performance Score | > 95 | 90-95 | < 90 |
| LCP | < 2.0s | 2.0-2.5s | > 2.5s |
| FID | < 100ms | 100-300ms | > 300ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |
| TTI | < 3.0s | 3.0-3.5s | > 3.5s |

**Running Performance Tests:**

```bash
# Start dev server and run Lighthouse
pnpm lighthouse

# Run against staging
TEST_URL=https://staging.example.com pnpm lighthouse

# Run against production
TEST_URL=https://app.example.com pnpm lighthouse
```

## Integration Testing

### Database Integration Tests

```typescript
// tests/integration/db/ideas.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { ideas, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Ideas Database Operations', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      id: 'test-user-' + Date.now(),
      email: 'test@example.com',
    }).returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(ideas).where(eq(ideas.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it('should create and retrieve idea', async () => {
    const [idea] = await db.insert(ideas).values({
      userId: testUserId,
      title: 'Test Idea',
      position: 0,
    }).returning();

    expect(idea).toHaveProperty('id');
    expect(idea.title).toBe('Test Idea');

    const retrieved = await db.query.ideas.findFirst({
      where: eq(ideas.id, idea.id),
    });

    expect(retrieved?.title).toBe('Test Idea');
  });

  it('should soft delete idea', async () => {
    const [idea] = await db.insert(ideas).values({
      userId: testUserId,
      title: 'To Delete',
      position: 0,
    }).returning();

    // Soft delete
    await db.update(ideas)
      .set({ deletedAt: new Date(), undoToken: 'token123' })
      .where(eq(ideas.id, idea.id));

    const deleted = await db.query.ideas.findFirst({
      where: eq(ideas.id, idea.id),
    });

    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.undoToken).toBe('token123');
  });
});
```

## Test Coverage Goals

**Coverage Targets:**

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80% | 65% |
| Branches | 75% | 60% |
| Functions | 80% | 70% |
| Lines | 80% | 65% |

**Critical Paths (100% coverage required):**
- Authentication flows
- Payment processing (if applicable)
- Data export/import
- Soft delete + undo

## CI/CD Integration

### GitHub Actions Workflow (Future)

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
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
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e-tests:
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

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm lighthouse
      - uses: actions/upload-artifact@v3
        with:
          name: lighthouse-report
          path: evidence/lighthouse-report.json
```

## Manual QA Checklist

**Pre-Release Checklist:**

- [ ] Authentication
  - [ ] Email login works
  - [ ] Password login works
  - [ ] Logout works
  - [ ] Session persists across refreshes
- [ ] Ideas CRUD
  - [ ] Create idea
  - [ ] Update idea (autosave)
  - [ ] Delete idea (soft delete)
  - [ ] Undo deletion
  - [ ] Reorder ideas (drag-and-drop)
- [ ] Features CRUD
  - [ ] Add feature to idea
  - [ ] Edit feature
  - [ ] Delete feature
  - [ ] Reorder features
  - [ ] Mark feature complete
- [ ] Export/Import
  - [ ] Export idea as JSON
  - [ ] Import idea from JSON
  - [ ] Duplicate detection works
- [ ] DevMode (if enabled)
  - [ ] Pairing works
  - [ ] Terminal connection works
  - [ ] Log streaming works
  - [ ] Job execution works
- [ ] Mobile Responsiveness
  - [ ] Layout works on mobile
  - [ ] Touch interactions work
  - [ ] No horizontal scroll
- [ ] Performance
  - [ ] Pages load < 3s
  - [ ] No layout shifts
  - [ ] Smooth animations
- [ ] Cross-Browser
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

---

**Related Documents:**
- `02-development-workflow.md` - Testing in dev workflow
- `05-operations-deployment.md` - CI/CD pipelines
- `07-security-compliance.md` - Security testing
