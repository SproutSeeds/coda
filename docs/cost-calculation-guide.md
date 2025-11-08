# Cost Calculation Guide

**Last Updated:** 2025-11-08
**Purpose:** Document real provider costs and per-action cost calculations for accurate user billing

---

## Provider Pricing (Current Plans)

### 1. Neon Postgres (Launch Plan)
- **Compute:** $0.106 per CU-hour (Compute Unit hour)
- **Storage:** $0.35 per GB-month
- **Written Data (PITR):** $0.20 per GB-month
- **Data Transfer:** FREE first 100GB, then $0.10 per GB

**Current Usage (Nov 2025):**
- Active time: 152.48 hours
- Compute time: 38.39 hours
- Written data: 253.65 GB
- Data transfer: 0.14 GB

### 2. Resend Email (Free Plan → Pro)
- **Free:** 3,000 emails/month = $0
- **Pro:** 50,000 emails/month = $20
- **Cost per email (Pro):** $20 / 50,000 = **$0.0004/email**
- **Cost per email (Scale):** $90 / 100,000 = **$0.0009/email**

**Current Plan:** Free (3,000 emails/month)

### 3. Vercel (Pro Plan)
- **Bandwidth:** First 1TB free, then $0.15 per GB
- **Serverless Executions:** 1M free, then $0.65 per million
- **Edge Requests:** No direct cost, bandwidth-based
- **Analytics:** Included in Pro ($20/month)

### 4. Fly.io Relay (Shared 1GB Machine)
- **VM:** shared-cpu-1x @ 1GB RAM
- **Compute:** ~$0.0000008 per second (auto-stop enabled)
- **Bandwidth:** FREE outbound within US
- **Bandwidth (outside US):** $0.02 per GB

---

## Usage Cost Model Snapshot

The canonical pricing metadata now lives in `lib/pricing/cost-model.ts`. Each entry carries the category, vendor, and human-readable labels that the dashboard accordion consumes. The table below mirrors those entries (keep it in sync when editing the code).

| Action | Label | Category | Vendor | Unit Label | Unit Cost (USD) |
| --- | --- | --- | --- | --- | --- |
| `idea.create` | Idea creation | Creation | neon_postgres | rows | $0.0000005 |
| `feature.create` | Feature creation | Creation | neon_postgres | rows | $0.00000054 |
| `collaborator.invite` | Collaborator invite email | Collaboration | email_delivery | emails | $0.0004003 |
| `collaborator.add` | Collaborator accepted | Collaboration | neon_postgres | rows | $0.0000004 |
| `join-request.create` | Join request | Collaboration | neon_postgres | rows | $0.0000005 |
| `idea.export` | Idea export | Delivery | vercel_bandwidth | exports | $0.000008 |
| `auth.email` | Auth email | Authentication | email_delivery | emails | $0.0004 |
| `analytics.event` | Analytics event | Analytics | vercel_analytics | events | $0.0000012 |
| `devmode.minute` | Dev Mode minute | Dev Mode | devmode_compute | minutes | $0.000048 |
| `devmode.byte` | Dev Mode bandwidth | Dev Mode | devmode_bandwidth | bytes | $0.000000004 |

### Projection Reference ($5 / $20 / $100)

`getUsageCostBudgets` automatically calculates purchasable units for each budget tier. These are the values surfaced in the accordion projection chips.

| Action | $5 Budget | $20 Budget | $100 Budget |
| --- | --- | --- | --- |
| `idea.create` | 10.0M rows | 40.0M rows | 200.0M rows |
| `feature.create` | 9.3M rows | 37.0M rows | 185.2M rows |
| `collaborator.invite` | 12.5K emails | 49.9K emails | 249.7K emails |
| `collaborator.add` | 12.5M rows | 50.0M rows | 250.0M rows |
| `join-request.create` | 10.0M rows | 40.0M rows | 200.0M rows |
| `idea.export` | 625K exports | 2.5M exports | 12.5M exports |
| `auth.email` | 12.5K emails | 50.0K emails | 250.0K emails |
| `analytics.event` | 4.2M events | 16.7M events | 83.3M events |
| `devmode.minute` | 104K minutes | 417K minutes | 2.1M minutes |
| `devmode.byte` | 1.25B bytes (~1.16 GB) | 5.0B bytes (~4.66 GB) | 25.0B bytes (~23.3 GB) |

> Tip: downstream UI chips borrow the formatted `summary` string from `UsageCostBudget`, so any copy/style updates should happen in the helper first.

---

## Per-Action Cost Calculations

### Database Actions (Neon Postgres)

#### idea.create
**What happens:**
- 1 INSERT into `ideas` table (~500 bytes)
- 1 INSERT into `idea_collaborators` table (~200 bytes)
- Storage: ~700 bytes total

**Cost breakdown:**
- Write cost: 700 bytes = 0.0000007 GB × $0.20/GB-month = $0.00000014/month
- Storage cost: 700 bytes × $0.35/GB-month = $0.000000245/month
- Compute estimate: ~5ms query time = 0.000001 CU-hour × $0.106 = $0.000000106

**Total:** ~$0.0000005 per idea created  
**Exact cost charged:** **$0.0000005**

#### feature.create
**What happens:**
- 1 INSERT into `idea_features` table (~800 bytes with JSONB)

**Cost breakdown:**
- Similar to idea creation but slightly larger payload
- Write: ~$0.00000016/month
- Storage: ~$0.00000028/month
- Compute: ~$0.0000001

**Total:** ~$0.00000054 per feature  
**Exact cost charged:** **$0.00000054**

####collaborator.invite
**What happens:**
- 1 INSERT into `idea_collaborator_invites` table (~300 bytes)
- 1 email sent via Resend

**Cost breakdown:**
- Database: ~$0.0000003
- Email (Pro plan): $0.0004

**Total:** $0.0004003  
**Exact cost charged:** **$0.0004003**

#### collaborator.add
**What happens:**
- 1 INSERT into `idea_collaborators` table (~200 bytes)
- 1 UPDATE to invite status (~100 bytes)

**Cost breakdown:**
- Database writes: ~$0.0000004

**Total:** ~$0.0000004  
**Exact cost charged:** **$0.0000004**

#### join-request.create
**What happens:**
- 1 INSERT into `idea_join_requests` table (~400 bytes with message)

**Cost breakdown:**
- Database: ~$0.0000005

**Total:** ~$0.0000005  
**Exact cost charged:** **$0.0000005**

---

### Email Actions (Resend)

#### auth.email (Magic link / Password reset)
**What happens:**
- 1 transactional email sent

**Cost breakdown:**
- Resend (Pro): $0.0004/email

**Total:** $0.0004  
**Exact cost charged:** **$0.0004**

---

### API/Bandwidth Actions (Vercel)

#### idea.export
**What happens:**
- Generate JSON export (avg ~50KB per idea + features)
- 1 serverless function invocation
- Bandwidth transfer

**Cost breakdown:**
- Function execution: $0.65/1M = $0.00000065
- Bandwidth: 50KB = 0.00005GB × $0.15 = $0.0000075
- Compute: ~100ms function time

**Total:** ~$0.000008  
**Exact cost charged:** **$0.000008**

#### analytics.event
**What happens:**
- 1 event logged to Vercel Analytics
- 1 INSERT into `usage_costs` table (~500 bytes)

**Cost breakdown:**
- Analytics: Included in Pro plan ($0)
- Database: ~$0.0000005
- Serverless execution: $0.00000065

**Total:** ~$0.0000012  
**Exact cost charged:** **$0.0000012**

---

### DevMode Actions (Fly.io + Bandwidth)

#### devmode.minute
**What happens:**
- 1 minute of relay VM runtime (shared-cpu-1x @ 1GB)
- WebSocket connection maintenance

**Cost breakdown:**
- Fly.io compute: 60 seconds × $0.0000008/sec = $0.000048
- With safety buffer (2x): $0.000096

**Total:** $0.000048  
**Exact cost charged:** **$0.000048**

#### devmode.byte
**What happens:**
- Terminal I/O data transfer through Fly.io relay
- Typical session: 1-5MB total

**Cost breakdown:**
- Fly.io bandwidth (within US): FREE
- Fly.io bandwidth (outside US): $0.02/GB = $0.00000002/byte
- Assume 80% US, 20% international: $0.000000004/byte

**Total:** ~$0.000000004/byte  
**Exact cost charged:** **$0.000000004/byte**

**Note:** At this scale, 1MB ≈ $0.005, which is negligible, but we still surface the precise byte-level rate.

---

## Storage Pricing Metadata

`lib/usage/storage.ts` now mirrors the action metadata with descriptions, Tailwind color tokens, and helpers for projections. Use `calculateStorageProjections` whenever you need the `$5/$20/$100` breakdown in UI or docs.

| Category | Description | Tailwind Color | Rate (USD / GB-month) | $5 Budget | $20 Budget | $100 Budget |
| --- | --- | --- | --- | --- | --- | --- |
| Rich Text & Docs (`text`) | Markdown, comments, and structured text stored in Neon. | `indigo` | $0.02 | 250 GB-month | 1,000 GB-month | 5,000 GB-month |
| Images & Visuals (`media`) | Uploaded images, cover art, and diagrams. | `cyan` | $0.05 | 100 GB-month | 400 GB-month | 2,000 GB-month |
| Audio & Large Assets (`audio`) | Audio captures, transcripts, large binaries. | `amber` | $0.08 | 62.5 GB-month | 250 GB-month | 1,250 GB-month |

---

## Model Verification

We finally retired the inflated placeholder rates. Keep this table updated whenever you tweak the canonical metadata so finance/support can confirm the delta at a glance.

| Action | Unit Cost (Code) | Calculated Cost | Delta |
| --- | --- | --- | --- |
| `idea.create` | $0.0000005 | $0.0000005 | ~1.0× (exact Neon calc) |
| `feature.create` | $0.00000054 | $0.00000054 | ~1.0× |
| `collaborator.invite` | $0.0004003 | $0.0004003 | ~1.0× (Resend Pro + Neon write) |
| `collaborator.add` | $0.0000004 | $0.0000004 | ~1.0× |
| `join-request.create` | $0.0000005 | $0.0000005 | ~1.0× |
| `idea.export` | $0.000008 | $0.000008 | ~1.0× |
| `auth.email` | $0.0004 | $0.0004 | ~1.0× |
| `analytics.event` | $0.0000012 | $0.0000012 | ~1.0× |
| `devmode.minute` | $0.000048 | $0.000048 | ~1.0× (Fly shared-cpu-1x) |
| `devmode.byte` | $0.000000004 | $0.000000004 | ~1.0× (Fly bandwidth blend) |

> Use `getUsageCostBudgets(action)` and `calculateStorageProjections(category)` in scripts/tests instead of duplicating math in-line.

### Analysis
Your current costs are **extremely conservative** (overcharging by 20-250x on most actions). This is actually GOOD for avoiding losses, but might make your product seem expensive.

---

## Recommended Production Costs

### Option A: Minimal Markup (Most Competitive)
Use calculated costs + 20% buffer:

```typescript
export const COST_MODEL: Record<UsageAction, CostModelEntry> = {
  "idea.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.000006, // Real: $0.000005 + 20%
  },
  "feature.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.000006,
  },
  "collaborator.invite": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.0006, // Real: $0.0005 + 20%
  },
  "collaborator.add": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.000006,
  },
  "join-request.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.000006,
  },
  "idea.export": {
    vendor: "vercel_bandwidth",
    unit: "requests",
    unitCost: 0.000012, // Real: $0.00001 + 20%
  },
  "auth.email": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.0006,
  },
  "analytics.event": {
    vendor: "vercel_analytics",
    unit: "requests",
    unitCost: 0.0000024, // Real: $0.000002 + 20%
  },
  "devmode.minute": {
    vendor: "devmode_compute",
    unit: "minutes",
    unitCost: 0.00012, // Real: $0.0001 + 20%
  },
  "devmode.byte": {
    vendor: "devmode_bandwidth",
    unit: "bytes",
    unitCost: 6e-9, // Real: 5e-9 + 20%
  },
};
```

### Option B: Sustainable Markup (Recommended)
Use calculated costs + 100% margin (2x):

```typescript
export const COST_MODEL: Record<UsageAction, CostModelEntry> = {
  "idea.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00001, // 2x for sustainability
  },
  "feature.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00001,
  },
  "collaborator.invite": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.001, // 2x
  },
  "collaborator.add": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00001,
  },
  "join-request.create": {
    vendor: "neon_postgres",
    unit: "rows",
    unitCost: 0.00001,
  },
  "idea.export": {
    vendor: "vercel_bandwidth",
    unit: "requests",
    unitCost: 0.00002,
  },
  "auth.email": {
    vendor: "email_delivery",
    unit: "emails",
    unitCost: 0.001,
  },
  "analytics.event": {
    vendor: "vercel_analytics",
    unit: "requests",
    unitCost: 0.000004,
  },
  "devmode.minute": {
    vendor: "devmode_compute",
    unit: "minutes",
    unitCost: 0.0002,
  },
  "devmode.byte": {
    vendor: "devmode_bandwidth",
    unit: "bytes",
    unitCost: 1e-8, // 2x
  },
};
```

### Option C: Current (Very Conservative)
Keep existing costs - you're already covered with massive margins, but users pay 20-250x more than actual cost.

---

## User-Facing Pricing

### Credits System
**Current:** 1 credit = $0.05

### Recommended Action Costs (in credits):

#### Option B Pricing (2x margin):
- **Create Idea:** 0.0002 credits (~$0.00001) → Display as **FREE**
- **Create Feature:** 0.0002 credits → **FREE**
- **Invite Collaborator:** 0.02 credits (~$0.001) → Display as **FREE** or **0.02 credits**
- **Add Collaborator:** 0.0002 credits → **FREE**
- **Join Request:** 0.0002 credits → **FREE**
- **Export Idea:** 0.0004 credits (~$0.00002) → **FREE**
- **Auth Email:** 0.02 credits (~$0.001) → **FREE**
- **DevMode Minute:** 0.004 credits (~$0.0002) → **0.01 credits** (round up)
- **DevMode Byte:** Too small to display individually

### Simplified User Pricing:
```
Core Actions: FREE (idea create, feature create, exports)
Collaboration: FREE (invites, adds, join requests under limits)
Auth Emails: FREE
DevMode: 0.01 credits per minute (~$0.0005/min)
```

---

## Monthly Cost Examples

### Light User (10 ideas, 30 features, 2 collaborators)
- Ideas: 10 × $0.00001 = $0.0001
- Features: 30 × $0.00001 = $0.0003
- Collaborators: 2 × $0.001 = $0.002
- **Total:** ~$0.0024/month → **FREE tier**

### Active User (50 ideas, 200 features, 10 collaborators, 5 hours DevMode)
- Ideas: 50 × $0.00001 = $0.0005
- Features: 200 × $0.00001 = $0.002
- Collaborators: 10 × $0.001 = $0.01
- DevMode: 300 min × $0.0002 = $0.06
- **Total:** ~$0.0725/month → 1.5 credits ($0.075)

### Power User (200 ideas, 1000 features, 50 collaborators, 40 hours DevMode)
- Ideas: 200 × $0.00001 = $0.002
- Features: 1000 × $0.00001 = $0.01
- Collaborators: 50 × $0.001 = $0.05
- DevMode: 2400 min × $0.0002 = $0.48
- **Total:** ~$0.542/month → 11 credits ($0.55)

---

## Reconciliation Strategy

### Monthly Process:
1. **Sum internal costs:** `SELECT SUM(total_cost) FROM usage_costs WHERE occurred_at >= '2025-11-01'`
2. **Check provider bills:**
   - Neon invoice
   - Resend invoice (if on paid plan)
   - Vercel invoice
   - Fly.io invoice
3. **Calculate variance:** `(actual_bill - internal_sum) / actual_bill × 100`
4. **Acceptable drift:** ±20%
5. **If > 20% drift:** Adjust cost model multipliers

### Example Reconciliation:
```
Internal tracked: $150
Actual bills:
  - Neon: $120
  - Resend: $0 (free tier)
  - Vercel: $20 (flat Pro)
  - Fly.io: $5
  Total: $145

Variance: ($145 - $150) / $145 = -3.4% ✅ GOOD
```

---

## Action Items

1. **Immediate:** Decide on Option A, B, or C for production costs
2. **Week 1:** Update `lib/pricing/cost-model.ts` with chosen costs
3. **Week 1:** Deploy and monitor `usage_costs` table
4. **Month 1:** Run reconciliation against actual provider bills
5. **Month 2:** Adjust costs based on real-world data
6. **Quarterly:** Review and optimize based on usage patterns

---

## Notes

- Database costs are negligible at this scale (~$0.000005 per row)
- Email costs dominate for high-collaboration users
- DevMode is most expensive feature (Fly.io compute)
- Consider making core CRUD actions completely free and only charging for DevMode + heavy collaboration
- Current Resend free tier (3,000 emails/month) covers ~50 users with 2 auth emails + 10 collab invites each
