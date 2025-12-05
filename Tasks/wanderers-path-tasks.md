# The Wanderer's Path - Implementation Tasks

> Reference: `/Philosophies/wanderers-path.md` for full context

---

## Status Overview

### Completed
- [x] Phase 1: Foundation (Database, Schema, Types)
- [x] Phase 2: Core UI (Path page, Hourglass, Stage cards)
- [x] Phase 3: Integration (Stages 1-5 tracking wired up)
- [x] Choose Path page (`/choose-path`)

### In Progress
- [ ] Phase 4: Polish (Animations, celebrations)
- [ ] Stages 6-10 task definitions and tracking

### Pending
- [ ] Phase 5: Testing
- [ ] Feature gating based on journey progress

---

## Phase 1: Foundation (COMPLETE)

### 1.1 Database Schema
- [x] Create migration file `0038_add_journey_system.sql`
- [x] Define `journey_progress` table
- [x] Define `journey_task_completions` table
- [x] Define `journey_stage_completions` table
- [x] Add user columns: `chosen_path`, `path_chosen_at`, `trial_ends_at`
- [x] Run migration on dev database

### 1.2 Drizzle Schema
- [x] Add `journeyProgress` table to `lib/db/schema/journey.ts`
- [x] Define TypeScript types (StageKey, TaskKey, etc.)
- [x] Export from main schema

### 1.3 Journey Utilities
- [x] Create `lib/journey/constants.ts` with all 10 stages
- [x] Create `lib/journey/types.ts` with interfaces
- [x] Create `lib/journey/progress.ts` with utilities
- [x] Create `lib/journey/tracker.ts` for action tracking
- [x] Create `lib/journey/index.ts` exports

---

## Phase 2: Core UI (COMPLETE)

### 2.1 Choose Path Page
- [x] Create `app/choose-path/page.tsx`
- [x] Create `app/choose-path/choose-path-client.tsx` with 3D cards
- [x] Create `app/choose-path/actions.ts` for path selection
- [x] Floating particle background
- [x] Card expand/collapse animation
- [x] Sparkle burst on selection
- [x] 3D tilt effect on hover
- [x] ESC key to close expanded card

### 2.2 Path Dashboard Page
- [x] Create `app/dashboard/path/page.tsx`
- [x] Create `app/dashboard/path/path-client.tsx`
- [x] Server component that fetches journey progress
- [x] Redirect to choose-path if no path chosen

### 2.3 Stage Components
- [x] Create `StageCard.tsx` - individual stage display
- [x] Create `JourneyProgress.tsx` - overall progress bar
- [x] Create `JourneyHeader.tsx` - page header
- [x] Visual states: locked, active, completed

### 2.4 Hourglass Component
- [x] Create `Hourglass.tsx` - displays sand/mana based on path
- [x] Wanderer view: crystallized sand, days remaining
- [x] Sorcerer view: mana pool unlocked

---

## Phase 3: Integration (STAGES 1-5 COMPLETE)

### 3.1 Server Actions Tracking
- [x] Import `trackJourneyAction` in ideas actions
- [x] Add tracking to `createIdeaAction`
- [x] Add tracking to `updateIdeaAction`
- [x] Add tracking to `createFeatureAction`
- [x] Add tracking to `updateFeatureAction`
- [x] Add tracking to `cycleIdeaStarAction`
- [x] Add tracking to `cycleFeatureStarAction`
- [x] Add tracking to `toggleFeatureCompletionAction`
- [x] Add tracking to `reorderFeaturesAction`
- [x] Add tracking to `exportIdeaAsJsonAction`
- [x] Add tracking to `convertFeatureToIdeaAction`

### 3.2 Page View Tracking
- [x] Track `visit_dashboard` on ideas page
- [x] Track `view_ideas_list` on ideas page
- [x] Track `view_idea_detail` on idea detail page
- [x] Track `view_path_complete` on path page (when Stage 5 done)

### 3.3 Stages 6-10 Integration (TODO)
- [ ] Stage 6: AI feature tracking (when AI is implemented)
- [ ] Stage 7: Advanced AI tracking
- [ ] Stage 8: DevMode tracking
- [ ] Stage 9: Collaboration tracking
- [ ] Stage 10: Mastery tracking

---

## Phase 4: Polish (IN PROGRESS)

### 4.1 Choose Path Animations
- [x] Floating particles
- [x] 3D tilt on hover
- [x] Card expand animation
- [x] Sparkle burst on selection
- [ ] Refine particle colors and density
- [ ] Add subtle ambient motion

### 4.2 Path Page Animations
- [ ] Stage unlock animation
- [ ] Task completion checkmark animation
- [ ] Mana bar fill animation
- [ ] Sand flow to hourglass animation

### 4.3 Celebrations
- [ ] Stage completion modal/toast
- [ ] Path completion celebration (Stage 5 for Wanderer)
- [ ] Ascension completion celebration (Stage 10 for Sorcerer)

### 4.4 Edge Cases
- [ ] Handle existing users with ideas (backfill progress)
- [ ] Handle concurrent task completions
- [ ] Handle page refresh state
- [ ] Handle trial expiration mid-journey

---

## Phase 5: Testing (TODO)

### 5.1 Unit Tests
- [ ] `lib/journey/progress.ts` utilities
- [ ] `lib/journey/tracker.ts` action mapping
- [ ] Mana calculation
- [ ] Stage completion detection

### 5.2 Integration Tests
- [ ] Path selection flow
- [ ] Task completion across pages
- [ ] Stage rewards (sand/mana pool)
- [ ] Trial extension for Wanderers

### 5.3 E2E Tests
- [ ] Full Wanderer journey (Stages 1-5)
- [ ] Full Sorcerer journey (Stages 1-10)
- [ ] Path switching mid-journey (if allowed)
- [ ] Progress persistence across sessions

---

## File Structure (Current)

```
lib/journey/
├── index.ts          # Exports
├── types.ts          # TypeScript interfaces
├── constants.ts      # All 10 stages defined
├── progress.ts       # Progress tracking utilities
└── tracker.ts        # Action → task completion mapping

lib/db/schema/
└── journey.ts        # Drizzle schema for journey tables

app/choose-path/
├── page.tsx          # Server component
├── choose-path-client.tsx  # 3D cards UI
└── actions.ts        # Path selection actions

app/dashboard/path/
├── page.tsx          # Server component
├── path-client.tsx   # Client component
└── components/
    ├── JourneyHeader.tsx
    ├── JourneyProgress.tsx
    ├── StageCard.tsx
    └── Hourglass.tsx

drizzle/migrations/
└── 0038_add_journey_system.sql
```

---

## Key Design Decisions

1. **Everyone starts at Stage 1** - Even Sorcerers who pay must complete the journey
2. **Wanderers stop at Stage 5** - They earn 30 days total (6 days × 5 stages)
3. **Sorcerers continue to Stage 10** - They unlock 200k mana pool + features
4. **One-time task completion** - Future similar actions don't re-trigger
5. **No passive mana regen** - Until Meditation unlocks at Stage 10

---

## Next Actions

1. Test the choose-path flow end-to-end
2. Test journey tracking for Stages 1-5
3. Add stage completion celebration UI
4. Implement Stages 6-10 when AI/DevMode features are ready

---

*Update this file as implementation progresses.*
