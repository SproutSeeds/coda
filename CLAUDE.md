# CLAUDE.md

Instructions for Claude Code when working in this repository.

---

## UI/UX Designer Consultation (ALWAYS DO THIS)

**For ANY UI/UX work, ALWAYS use the `ui-animation-specialist` agent first.**

Before implementing, modifying, or reviewing ANY of the following:
- New pages or layouts
- Component styling or redesigns
- Animations and transitions (Framer Motion)
- Hover effects, micro-interactions
- Scroll-triggered animations
- Loading states and skeleton screens
- Mobile responsiveness
- Visual hierarchy and spacing
- Color usage and theming

**How to consult:**
```
Use Task tool with subagent_type='ui-animation-specialist' to:
1. Research current best practices for the specific UI pattern
2. Review existing patterns in our codebase for consistency
3. Ensure alignment with our Linear-style design language
4. Get recommendations before writing any UI code
```

This ensures every UI decision is informed by modern best practices and maintains visual consistency across the 500+ hours of work in this codebase.

---

## Core Principles

1. **SIMPLICITY IS EVERYTHING** - Every change should impact as little code as possible
2. **NEVER BE LAZY** - Find root causes, no temporary fixes, no shortcuts
3. **NO BUGS** - Simple changes = fewer bugs. You are a senior developer.
4. **DESIGN WITH INTENTION** - Every pixel matters. Consult UI/UX guidance before visual changes.

### What NOT To Do
- No massive or complex changes
- No temporary fixes or workarounds
- No changes beyond what's necessary for the task
- No guessing - read the code first
- **No UI changes without consulting the ui-animation-specialist agent**
- No inconsistent spacing, colors, or animation timings

---

## Design System & UI Stack

### Tech Stack
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui** - Base component library (`components/ui/`)
- **Framer Motion v12** - React state-driven animations
- **GSAP v3** - Timeline, scroll, and complex animations
- **Three.js** - WebGL effects (TubesEffect, etc.)
- **Next.js App Router** - Server components, layouts, streaming

### Component Hierarchy
```
components/
├── ui/              # shadcn/ui base components (Button, Card, Input, etc.)
├── effects/         # Visual effects (MorphingText, TubesEffect)
├── tutorial/        # Onboarding components
├── account/         # Account-related UI
└── footer.tsx       # Global footer
```

### Animation Guidelines

#### Choosing the Right Tool
| Use Case | Tool | Why |
|----------|------|-----|
| Component mount/unmount | Framer Motion | AnimatePresence handles exit animations |
| React state-driven animations | Framer Motion | Direct integration with React lifecycle |
| Scroll-triggered animations | GSAP ScrollTrigger | Superior performance, pinning, scrubbing |
| Complex timelines/sequencing | GSAP | Timeline API is unmatched |
| Text/character animations | GSAP SplitText | Purpose-built for text manipulation |
| Physics-based motion | Framer Motion | Built-in spring physics |
| SVG morphing/drawing | GSAP | MorphSVG, DrawSVG plugins |
| Parallax effects | GSAP ScrollTrigger | Smooth, performant parallax |
| Hover micro-interactions | Framer Motion or CSS | Simpler, React-integrated |
| WebGL/3D effects | Three.js | Full 3D rendering capability |

#### Framer Motion Defaults
- Standard easing: `ease: [0.25, 0.1, 0.25, 1]` (cubic-bezier)
- Standard duration: 200-300ms for micro-interactions, 400-600ms for page transitions
- Always include `reduced-motion` media query fallbacks

#### GSAP Best Practices
```typescript
// Use the React hook for proper cleanup
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// Register plugins once at app level
gsap.registerPlugin(ScrollTrigger);

// Inside components:
useGSAP(() => {
  gsap.to(".element", { x: 100, duration: 1 });
}, { scope: containerRef }); // Scoped for cleanup
```

### Spacing & Layout
- Use Tailwind spacing scale consistently (4, 8, 12, 16, 24, 32, 48, 64)
- Mobile-first responsive design
- Container max-widths: `max-w-7xl` for full pages, `max-w-4xl` for content

### Color Philosophy
- Dark theme primary
- Accent colors used sparingly for CTAs and important actions
- Semantic colors for states (success, warning, error)
- Muted variants for secondary text and borders

---

## Task Execution Protocol

### Before Writing Code
1. **Think through the problem**
2. **Read relevant files** - Explore the codebase, understand existing patterns
3. **For UI work: Consult ui-animation-specialist agent** (see above)
4. **Write a plan** to `Tasks/<feature-name>.md` with checkable todos
5. **Stop and check in with user** - Get plan verification before any code changes

### During Implementation
6. Work through todos sequentially, marking `[x]` as complete
7. **Narrate your progress** - High-level explanation after each change
8. Keep changes minimal - only touch code necessary for the task
9. **Verify changes work** - Run typecheck/lint/test as appropriate
10. **Visual QA** - Test on mobile viewport, check animations, verify dark theme

### After Completion
11. Add a **Review** section to the task file with:
    - Summary of changes
    - Files modified
    - UI/UX decisions made and rationale
    - Any follow-up items

---

## Essential Commands

```bash
pnpm dev            # Start dev server (localhost:3000)
pnpm typecheck      # Type checking
pnpm lint           # Linting
pnpm test           # Unit tests
```

---

## Project Structure

```
app/                  # Next.js App Router (pages, server actions)
lib/                  # Core logic (db, auth, utils, validations)
components/           # Shared UI components (see hierarchy above)
drizzle/migrations/   # Database migrations
Tasks/                # Task tracking files
Philosophies/         # Design decision documents
docs/                 # Detailed documentation
prompts/              # Reusable prompt templates
```

---

## Git Workflow

1. **Always work on feature branches** - never commit directly to `main`
2. Create branch: `git checkout -b feat/<name>` or `fix/<name>`
3. Push and wait for Vercel preview build to pass
4. Merge to main only after preview succeeds
5. Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`

---

## Key Patterns

- **Server Actions**: All mutations in `app/dashboard/ideas/actions/`
- **Database**: Drizzle ORM, schema in `lib/db/schema.ts`
- **Auth**: Auth.js with email magic links
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Animation**: Framer Motion (React state) + GSAP (scroll/timeline)
- **Effects**: Custom visual effects in `components/effects/`

---

## Where to Find Details

| Topic | Location |
|-------|----------|
| Architecture | `docs/` |
| Feature specs | `Philosophies/` |
| Environment vars | `.env.example` |
| Database schema | `lib/db/schema.ts` |
| API patterns | `app/api/` |
| UI Components | `components/ui/` |
| Visual Effects | `components/effects/` |
| Prompt Templates | `prompts/` |

---

## GSAP Reference Guide

GSAP (GreenSock Animation Platform) is installed and available for complex animations.

### When to Reach for GSAP
- **Scroll-driven animations** - ScrollTrigger is industry-leading
- **Timeline sequences** - Multiple elements animating in choreographed order
- **Text animations** - Character-by-character, word-by-word reveals
- **SVG manipulation** - Path drawing, morphing shapes
- **Pinned sections** - Elements that stick during scroll
- **Scrub animations** - Animations tied directly to scroll position
- **Stagger effects** - Animating lists/grids with delays
- **Complex easing** - Custom bezier curves, elastic, bounce effects

### GSAP Core Concepts
```typescript
// Basic tween
gsap.to(".box", { x: 100, opacity: 1, duration: 1 });

// Timeline for sequencing
const tl = gsap.timeline();
tl.to(".first", { y: -20 })
  .to(".second", { y: -20 }, "-=0.3") // overlap by 0.3s
  .to(".third", { y: -20 }, "<"); // start same time as previous

// ScrollTrigger
gsap.to(".parallax", {
  y: -100,
  scrollTrigger: {
    trigger: ".section",
    start: "top bottom",
    end: "bottom top",
    scrub: true, // ties animation to scroll position
  }
});

// Stagger animations
gsap.to(".card", {
  y: 0,
  opacity: 1,
  stagger: 0.1, // 0.1s delay between each
  duration: 0.6
});
```

### GSAP Easing Presets
| Easing | Use Case |
|--------|----------|
| `power2.out` | Natural deceleration (default choice) |
| `power3.inOut` | Smooth page transitions |
| `back.out(1.7)` | Playful overshoot |
| `elastic.out(1, 0.3)` | Bouncy, springy feel |
| `expo.out` | Dramatic fast-to-slow |
| `none` | Linear (for scrub animations) |

### GSAP + React Pattern
```typescript
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function AnimatedSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // All GSAP code here - auto-cleaned up on unmount
    gsap.from(".item", {
      y: 50,
      opacity: 0,
      stagger: 0.1,
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
      }
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef}>
      <div className="item">Item 1</div>
      <div className="item">Item 2</div>
    </div>
  );
}
```

---

## UI/UX Quick Reference

### When to Use What Animation
| Interaction | Duration | Easing |
|------------|----------|--------|
| Button hover | 150ms | ease-out |
| Modal open | 300ms | spring |
| Page transition | 400ms | ease-in-out |
| Skeleton pulse | 1.5s | linear loop |
| Toast notification | 200ms in, 150ms out | ease |
| Scroll reveal | 0.6s | power2.out (GSAP) |
| Stagger list items | 0.1s delay | power2.out (GSAP) |
| Parallax scroll | scrub | none/linear (GSAP) |

### Responsive Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Z-Index Scale
- Base content: 0
- Sticky headers: 10
- Dropdowns: 20
- Modals: 30
- Toasts: 40
- Tooltips: 50
