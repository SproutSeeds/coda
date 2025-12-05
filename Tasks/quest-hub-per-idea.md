# Quest Hub - Per-Idea Journey System

## Overview

The Quest Hub guides users through building out each idea via a structured journey. When a user chooses their path (Wanderer or Sorcerer), they complete quests **attached to specific ideas**, not abstract global tasks.

---

## Core Architecture

### 1. Idea Selector Component
- Search bar at top of Quest Hub (`/dashboard/path`)
- Dropdown shows recently updated/created ideas
- User selects which idea they're actively questing on
- Default: most recently created idea (or prompt to create one)

### 2. Per-Idea Quest State
**New table: `idea_journey_progress`**
```
- id: uuid
- idea_id: uuid (FK to ideas)
- user_id: uuid (FK to auth_user)
- current_stage: integer (1-10)
- tasks_completed: jsonb (same structure as before)
- stages_completed: jsonb
- created_at: timestamp
- updated_at: timestamp
```

### 3. Global vs Per-Idea Tasks

| Global (once per user) | Per-Idea (each idea) |
|------------------------|----------------------|
| Choose your path | Add first feature |
| Visit dashboard | Add second feature |
| Create first idea ever | Add notes to features |
| View the Quest Hub | Star important features |
| | Complete features |
| | Add GitHub link |
| | Export idea |

---

## Stage Breakdown

### Part I: The Wanderer's Path (All Users)

**Stage 1: Awakening** - *Global*
- Enter the workshop (visit dashboard)
- Name your vision (create an idea)
- Give it form (add notes to idea)
- See it manifest (view ideas list)
- Return to your creation (view idea detail)

**Stage 2: First Sketch** - *Per-Idea*
- Break it down (add first feature to THIS idea)
- And another (add second feature to THIS idea)
- Describe the piece (add notes to a feature)
- Go deeper (add detail to a feature)
- Shape takes hold (3+ features on THIS idea)

**Stage 3: Taking Shape** - *Per-Idea*
- Mark what matters (star a feature on THIS idea)
- Prioritize within (reorder features)
- The workshop grows (5+ features on THIS idea)
- Structure emerges (add detail sections)
- Foundation set (all features have notes)

**Stage 4: The Craftsman's Mark** - *Per-Idea*
- First completion (mark a feature complete)
- Refine the vision (edit idea title)
- Deepen the description (edit idea notes)
- Polish a facet (edit a feature)
- Steady progress (50% features complete)

**Stage 5: The Connected Workshop** - *Per-Idea*
- Elevate importance (super-star the idea)
- Link to the world (add GitHub URL)
- Preserve your work (export as JSON)
- Ready for review (all features have detail)
- Foundation complete (view completion summary)

---

### Part II: The Sorcerer's Ascension (Paid Users)

**Stage 6: The Oracle's Gift** - *Per-Idea + Evaluation*
- Seek the Oracle (open AI panel on THIS idea)
- Ask a question (send message about THIS idea)
- **CHECKPOINT: Consult Source** (AI evaluates idea structure)
- Apply the wisdom (use AI suggestion)
- The Oracle knows you (AI references idea context)

**Stage 7: The Codex Opens** - *Per-Idea + DevMode*
- Summon the companion (download Runner app)
- Establish the link (pair device)
- Open the portal (launch terminal for THIS idea)
- Speak to the machine (execute a command)
- The codex lives (run dev server)

**Stage 8: The Scribe's Discipline** - *Per-Idea + Evaluation*
- Structure the chaos (create detail sections)
- Organize knowledge (3+ sections per feature)
- **CHECKPOINT: Consult Source** (AI evaluates documentation quality)
- Refine by feedback (address AI suggestions)
- Master of organization (all features documented)

**Stage 9: The Circle Expands** - *Per-Idea (Future)*
- Make idea public
- Invite collaborator
- Receive feedback
- Iterate together
- Shared vision complete

**Stage 10: Ascension** - *Per-Idea + Final Evaluation*
- **CHECKPOINT: Consult Source** (full idea review)
- All features complete
- All documentation complete
- AI approval received
- Idea marked "Ready to Build"

---

## Evaluation Checkpoints (Sorcerer Only)

At key stages, a "Consult Source" button appears:

1. **Triggers AI evaluation** of the current idea
2. **Checks for**:
   - Idea has clear title and description
   - Features are well-defined
   - Appropriate level of detail
   - No obvious gaps or ambiguities
3. **Returns feedback**:
   - Pass: "Your idea is ready. Proceed."
   - Needs work: "Consider adding X, clarifying Y..."
4. **User must address feedback** (or acknowledge) to proceed

---

## Database Changes

### New Table: `idea_journey_progress`
```sql
CREATE TABLE idea_journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  current_stage INTEGER NOT NULL DEFAULT 2,  -- Starts at stage 2 (per-idea)
  tasks_completed JSONB NOT NULL DEFAULT '{}',
  stages_completed JSONB NOT NULL DEFAULT '{}',
  last_evaluation_at TIMESTAMPTZ,
  last_evaluation_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idea_id)  -- One progress record per idea
);
```

### Keep Existing: `journey_progress`
- Still tracks global user state (chosen path, Stage 1 completion)
- `current_stage` indicates which global stage user is on
- Once Stage 1 complete, per-idea tracking takes over

---

## UI Changes

### Quest Hub Page (`/dashboard/path`)

```
┌─────────────────────────────────────────────────┐
│  > THE_QUEST_HUB_                               │
│                                                 │
│  Walk the path. Earn your time.                 │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🔍 Select an idea to quest on...        │   │
│  │    ┌─────────────────────────────────┐  │   │
│  │    │ My New App (updated 2m ago)     │  │   │
│  │    │ Website Redesign (updated 1h)   │  │   │
│  │    │ API Integration (updated 2d)    │  │   │
│  │    └─────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Part I: THE_WANDERER'S_PATH                   │
│                                                 │
│  ┌─ Stage 1: Awakening ─────────── COMPLETE ─┐ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Stage 2: First Sketch ──────── CURRENT ──┐ │
│  │  Working on: "My New App"                  │ │
│  │                                            │ │
│  │  ✓ Break it down                          │ │
│  │  ○ And another                            │ │
│  │  ○ Describe the piece                     │ │
│  │  ...                                       │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Auto-Scan Logic (On Idea Selection)

When a user selects an idea in the Quest Hub, the system scans the idea's current state and auto-completes applicable tasks:

```typescript
async function scanIdeaForQuestProgress(ideaId: string): Promise<TasksCompleted> {
  const idea = await getIdeaWithFeatures(ideaId);
  const tasks: TasksCompleted = {};

  // Stage 2: First Sketch
  const featureCount = idea.features.length;
  tasks.stage_2 = {
    task_1: featureCount >= 1,                    // Break it down (1+ features)
    task_2: featureCount >= 2,                    // And another (2+ features)
    task_3: idea.features.some(f => f.notes),     // Describe the piece (any feature has notes)
    task_4: idea.features.some(f => f.detail),    // Go deeper (any feature has detail)
    task_5: featureCount >= 3,                    // Shape takes hold (3+ features)
  };

  // Stage 3: Taking Shape
  tasks.stage_3 = {
    task_1: idea.features.some(f => f.starred),   // Mark what matters
    task_2: true, // Can't detect reorder history - skip or always true
    task_3: featureCount >= 5,                    // Workshop grows (5+ features)
    task_4: idea.features.some(f => f.detailSections?.length > 0), // Structure emerges
    task_5: idea.features.every(f => f.notes),    // All features have notes
  };

  // Stage 4: Craftsman's Mark
  const completedCount = idea.features.filter(f => f.completed).length;
  tasks.stage_4 = {
    task_1: completedCount >= 1,                  // First completion
    task_2: true, // Can't detect edit history - marked on action
    task_3: true, // Can't detect edit history - marked on action
    task_4: true, // Can't detect edit history - marked on action
    task_5: featureCount > 0 && completedCount >= featureCount * 0.5, // 50% complete
  };

  // Stage 5: Connected Workshop
  tasks.stage_5 = {
    task_1: idea.superStarred,                    // Elevate importance
    task_2: !!idea.githubUrl,                     // Link to the world
    task_3: false, // Export - can only be marked on action
    task_4: idea.features.every(f => f.detail),   // All features have detail
    task_5: false, // Completion summary - marked on action
  };

  return tasks;
}
```

**Key principle**: Scan what CAN be detected from current state. Some tasks (like "edit a feature") can only be marked when the action happens - those stay false until explicitly completed.

---

## Implementation Phases

### Phase 1: Database & Core Logic
- [ ] Create `idea_journey_progress` table migration
- [ ] Update tracker to check idea-specific progress
- [ ] Modify `trackJourneyAction` to accept idea context
- [ ] Create `getIdeaJourneyProgress(ideaId)` function

### Phase 2: Idea Selector UI
- [ ] Build IdeaSelector component (search + dropdown)
- [ ] Fetch recent ideas for dropdown
- [ ] Store selected idea in URL param or state
- [ ] Update Quest Hub to show per-idea progress

### Phase 3: Per-Idea Task Tracking
- [ ] Wire up Stage 2-5 tasks to idea-specific tracking
- [ ] Update StageCard to show correct idea's progress
- [ ] Handle idea switching (show different progress)

### Phase 4: Evaluation Checkpoints (Sorcerer)
- [ ] Design evaluation prompt for AI
- [ ] Build "Consult Source" button component
- [ ] Create evaluation result UI (pass/feedback)
- [ ] Store evaluation results in `idea_journey_progress`

### Phase 5: Polish
- [ ] Celebration animations on stage completion
- [ ] Progress persistence across sessions
- [ ] Mobile responsive idea selector
- [ ] Empty state (no ideas yet)

---

## Answered Questions

1. **Shared rewards, independent progress**
   - **Rewards are global** - Completing Stage 2 for the first time (on any idea) grants the crystallized sand. Only once.
   - **Progress is per-idea** - Each idea tracks its own quest completion independently.
   - Example:
     - "Idea A" completes Stage 2 → User earns +6 sand (first time)
     - "Idea B" completes Stage 2 → No additional reward, but Idea B's quest shows Stage 2 complete
   - This allows users to build out multiple ideas thoroughly without being penalized or over-rewarded.

2. **What happens when selecting an existing idea?**
   - **Auto-scan the idea** against quest requirements.
   - If idea already has 3 features → "Break it down", "And another", "Shape takes hold" auto-complete.
   - If idea has GitHub URL → "Link to the world" auto-completes.
   - System evaluates current state and marks completed steps accordingly.
   - User continues from where the idea's state leaves off.

3. **Quest state per idea**
   - Each idea has saved quest progress.
   - Switching ideas shows that idea's quest state.
   - Progress persists - come back to an idea later, pick up where you left off.

## Open Questions

1. **Minimum requirements before evaluation checkpoint?**
   - Must have X features with notes?
   - Or just attempt evaluation anytime?

---

## Review

*To be filled after implementation*

- Changes made:
- Files modified:
- Follow-up items:
