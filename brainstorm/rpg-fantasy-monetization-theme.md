# Coda RPG/Fantasy Monetization Theme - Full Brainstorm

**Inspired by:** EverQuest, fantasy MMORPGs, magic systems
**Date:** November 15, 2025
**Status:** Brainstorm - Not yet implemented

---

## Core Concept: Mana-Based Magic System

Replace boring SaaS terminology with immersive RPG fantasy:

| Old (Boring) | New (Epic) |
|--------------|------------|
| AI credits | **Mana points** |
| Using AI features | **Casting spells** |
| Subscription tiers | **Adventurer ranks** |
| Buy credits | **Drink mana potions** |
| Monthly allowance | **Mana pool regeneration** |
| Top-up credits | **Mana reserve** |

---

## The Mana System (EverQuest-Inspired)

### Mana Pool vs Mana Reserve

**Mana Pool (Base Mana):**
- Your monthly renewable mana
- Resets on billing cycle (like EQ mana regenerating when you rest at inn)
- Use it or lose it
- Displayed as "base mana"

**Mana Reserve (Boost Mana):**
- Purchased mana that doesn't expire
- Stacks on top of your pool
- Like mana potions in your inventory
- Used only when pool is empty

**Example Display:**
```
MANA POOL
⚡ 1,700 total available
├─ 1,200 base mana (regenerates in 23 days)
└─ 500 reserve mana (from potions)
```

---

## The 10 Adventurer Ranks

### Tier 1: **WANDERER** - $0/month
**Who you are:** Curious traveler just entering the realm

**Your Power:**
- 0 mana/month
- Can't cast spells yet
- 3 active quests (ideas)
- 1 GB storage (small backpack)

**Unlock Message:**
> "You've explored enough, Wanderer. Ready to become an Apprentice?"

---

### Tier 2: **APPRENTICE** - $10/month
**Who you are:** Learning the basics, using your own magic

**Your Power:**
- 0 Coda mana (you bring your own magic source)
- Connect your own spell components (OpenAI/Anthropic API keys)
- Unlimited quests
- 5 GB adventurer's pack

**Fantasy Flavor:**
> "As an Apprentice, you've learned to channel magic from external sources. Skilled wizards who prefer to manage their own spell components choose this path."

---

### Tier 3: **MAGE** ⭐ - $25/month
**Who you are:** Apprenticed to the guild, using guild-provided magic

**Your Power:**
- **1,500 mana/month** (regenerates monthly)
- Pre-crafted spells that just work
- 10 GB mage tower storage
- Guild Spellbook unlocked

**Available Spells:**
```
⚡ Summon Vision (5 mana) - Generate feature description
⚡ Divine Insight (10 mana) - Analyze idea viability
⚡ Tome of Knowledge (25 mana) - Create full documentation
⚡ Crystal Ball (15 mana) - Market research
⚡ Arcane Analysis (20 mana) - Technical breakdown
```

**Fantasy Flavor:**
> "As a Mage, the guild provides you with 1,500 mana each moon cycle. Your spellbook contains powerful, pre-crafted incantations. Most adventurers choose this path."


## Spell Casting Costs

### Basic Spells (1-5 mana)
```
⚡ Minor Summoning (1 mana)
  └─ Quick AI text generation

⚡ Summon Vision (5 mana)
  └─ Feature description generation
```

### Intermediate Spells (10-20 mana)
```
⚡ Divine Insight (10 mana)
  └─ Image analysis/description

⚡ Enhancement Ward (15 mana)
  └─ Image enhancement

⚡ Arcane Analysis (20 mana)
  └─ Deep technical breakdown
```

### Advanced Spells (25+ mana)
```
⚡ Tome of Knowledge (25 mana)
  └─ Full documentation creation

⚡ Scribe's Ritual (8 mana per minute)
  └─ Audio transcription

⚡ Grand Transcription (18 mana per minute)
  └─ Video transcription
```

---

## Mana Potions (Top-Up Packs)

### Small Mana Potion - $10
- Grants: **800 reserve mana**
- Goes straight to your mana reserve
- Never expires

### Medium Mana Potion - $25 ⭐
- Grants: **2,000 reserve mana**
- Best value for most mages

### Large Mana Potion - $50
- Grants: **4,200 reserve mana**
- Bulk discount applied

### Grand Elixir - $100
- Grants: **8,800 reserve mana**
- Ultimate power boost

**UI Display Example:**
```
┌─────────────────────────────────┐
│  Recharge Your Mana             │
├─────────────────────────────────┤
│  🧪 Small Potion    $10         │
│     800 mana                    │
│                                 │
│  🧪 Medium Potion   $25  ⭐     │
│     2,000 mana                  │
│                                 │
│  🧪 Large Potion    $50         │
│     4,200 mana    (best value)  │
│                                 │
│  🧪 Grand Elixir    $100        │
│     8,800 mana    (ultimate)    │
└─────────────────────────────────┘
```

---

## In-App Messaging (Fantasy Style)

### When Mana Depleted
**Old (boring):**
> "You're out of credits. Buy more credits or upgrade your plan."

**New (epic):**
> "Your mana pool has been exhausted!
>
> ⚗️ Drink a mana potion to continue casting
> 🔮 Advance your rank for a larger mana pool
>
> [View Potions] [Advance Rank]"

---

### When Spell is Cast
**Old:**
> "This will use approximately 5 credits"

**New:**
> "⚡ Summon Vision
>
> Casting this spell requires 5 mana
> Remaining after cast: 1,695 mana
>
> [Cast Spell] [Cancel]"

---

### Low Mana Warning
**Old:**
> "You have 20% credits remaining"

**New:**
> "⚠️ Your mana reserves are running low!
>
> Only 240 mana remains in your pool.
> Consider drinking a mana potion or advancing your rank.
>
> [Recharge Mana]"

---

### Successful Spell Cast
**Old:**
> "Generation complete. 5 credits used."

**New:**
> "✨ Summon Vision cast successfully!
>
> Mana consumed: 5
> Remaining mana: 1,695
>
> [View Result]"

---

## Dashboard UI (Character Sheet Style)

```
┌────────────────────────────────────────────────────────────┐
│  YOUR ADVENTURER PROFILE                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  RANK            Mage ⭐                        [Advance]  │
│  NEXT RANK       Coming soon (Mage is current pinnacle)   │
│                                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                            │
│  MANA POOL                                                 │
│  ⚡ 1,700 / 1,700 total available                         │
│  ├─ 1,200 base mana (regenerates in 23 days)             │
│  └─ 500 reserve mana (from potions)                       │
│                                                            │
│  [Recharge Mana]                                          │
│                                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                            │
│  STORAGE                                                   │
│  📦 2.3 GB / 10 GB used                                   │
│  ▓▓▓▓░░░░░░░░░░ 23%                                       │
│                                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                            │
│  RECENT SPELL ACTIVITY                                     │
│                                                            │
│  Nov 15  ⚡ Summon Vision              -5 mana            │
│  Nov 15  🧪 Drank Medium Mana Potion   +2,000 mana        │
│  Nov 15  ⚡ Divine Insight             -10 mana           │
│  Nov 14  🔮 Rank Advanced to Mage      +1,200 base        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Upgrade Prompts (Fantasy Style)

### Wanderer → Apprentice
```
┌─────────────────────────────────────────────┐
│  YOUR JOURNEY BEGINS                        │
├─────────────────────────────────────────────┤
│                                             │
│  You've explored the realm as a Wanderer.   │
│  Ready to begin your apprenticeship?        │
│                                             │
│  BECOME AN APPRENTICE                       │
│  10 gold pieces per moon                    │
│                                             │
│  ✓ Unlimited quests                         │
│  ✓ 5 GB adventurer's pack                   │
│  ✓ Channel external magic (BYO API)         │
│  ✓ Guild support                            │
│                                             │
│  [Begin Apprenticeship]  [Stay Wanderer]    │
│                                             │
└─────────────────────────────────────────────┘
```

## Pricing Page (Quest Board Style)

```
╔══════════════════════════════════════════════════════════════╗
║              CHOOSE YOUR PATH IN THE REALM                    ║
╚══════════════════════════════════════════════════════════════╝

  WANDERER      APPRENTICE       MAGE ⭐
     $0            10 gold         25 gold

  Try the       DIY Magic        Guild Magic
   realm                          + Spellbook

  0 mana        0 mana*          1,500 mana
  3 quests      ∞ quests         ∞ quests
  1 GB          5 GB             10 GB
                *Bring own       Pre-built
                 spell comps     spells

  [Explore]     [Apprentice]     [Become Mage]
```

---

## Email Notifications (Fantasy Style)

### Monthly Billing
**Subject:** Your mana pool has been replenished! ⚡

```
Greetings, Mage!

The moon cycle has turned, and your mana pool has been restored.

YOUR RENEWED POWER:
⚡ 1,500 base mana (full pool)
⚡ 500 reserve mana (carried over from potions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 1,700 mana available

LAST CYCLE'S ACTIVITY:
• Spells cast: 47
• Mana consumed: 843
• Most used: Summon Vision (23 casts)

Your next replenishment: December 15, 2025

May your spells be powerful,
The Coda Council

[View Character Sheet]
```

---

### Low Mana Warning
**Subject:** ⚠️ Your mana reserves are running low

```
Brave adventurer,

Your mana pool is nearly depleted!

CURRENT RESERVES:
⚡ 180 mana remaining (12%)

You may wish to:
🧪 Drink a mana potion ($10-$100)
🔮 Advance your rank for a larger pool
⏳ Wait 18 days for monthly replenishment

[Recharge Now] [View Potions] [Advance Rank]

Safe travels,
The Coda Council
```

---

## Gamification Ideas

### Spell Mastery Badges
```
🏆 APPRENTICE SUMMONER
    Cast your first Summon Vision spell

🏆 ARCANE ADEPT
    Cast 100 spells total

🏆 GRAND MAGUS
    Consumed 10,000 mana lifetime

🏆 POTION MASTER
    Purchased your first mana potion

🏆 COUNCIL ELDER
    Maintained Mage rank for 6 moon cycles
```

### Monthly Quest Rewards
```
Complete monthly quests to earn bonus mana!

NOVEMBER QUESTS:
☐ Cast 10 different spell types        +100 bonus mana
☐ Invite a fellow adventurer            +200 bonus mana
☐ Complete 5 ideas this month           +150 bonus mana
☑ Use Coda 15 days this month           +100 bonus mana ✓
```

---

## EverQuest References & Vibes

Key elements pulled from classic EQ:
- **Mana system** (regenerates vs potions, just like EQ)
- **Ranks/progression** (like leveling 1-60)
- **Spell names** (not "generate text" but "Summon Vision")
- **Guild structure** (solo → small group → guild → raid alliance)
- **Fantasy locations** (tower, sanctum, demiplane like zones)
- **Loot/items** (mana potions like healing potions)
- **Moon cycles** (billing periods = EQ moon phases)

### Potential EQ-Specific Easter Eggs

Could add references to:
- Kelethin (wood elf tree city) - you mentioned running around there!
- Classes (Wizard, Enchanter, Necromancer paths?)
- Zones (Lesser Faydark, Greater Faydark, Crushbone)
- NPCs (guild masters, trainers)
- Camps/grinding (monthly quests like camping spawns)

---

## Implementation Priority

### Phase 1: Core Terminology (Week 1-2)
- [ ] Update all "credits" → "mana"
- [ ] Update UI displays (mana pool, base vs reserve)
- [ ] Change button text ("Cast Spell" vs "Generate")
- [ ] Update notification copy

### Phase 2: Rank Names (Week 3-4)
- [ ] Rename tiers (Basic → Apprentice, Pro → Mage, etc.)
- [ ] Update pricing page
- [ ] Update dashboard/billing page
- [ ] Update upgrade prompts

### Phase 3: Spell System (Week 5-8)
- [ ] Name each AI operation (spell names)
- [ ] Create spell catalog/grimoire UI
- [ ] Add spell casting animations/effects
- [ ] Spell mastery badges

### Phase 4: Full Immersion (Week 9-12)
- [ ] Quest system (monthly challenges)
- [ ] Achievement badges
- [ ] Fantasy email templates
- [ ] Character sheet dashboard
- [ ] Mana potion shop UI

---

## Open Questions

1. **How far do we lean into fantasy?**
   - Light theme (just rename things) vs full RPG experience?
   - Do we add animations, sound effects, particle effects?

2. **Do we allow users to toggle theme?**
   - Some users might prefer "Professional mode" (credits/subscriptions)
   - Could have a setting: Fantasy Theme vs Business Theme

3. **Spell names - user customizable?**
   - Let users rename spells to their own preference?
   - Or stick with canon spell names?

4. **Voice/tone in all communications?**
   - Marketing site stays fantasy-themed?
   - Support emails from "The Coda Council"?
   - Legal docs still "Terms of Service" or "Guild Covenant"?

---

## Why This Works

**Differentiation:** No other SaaS product does this. Instantly memorable.

**Engagement:** Gamification increases usage. Players (users) want to level up, earn badges, complete quests.

**Reduces friction:** "Out of mana" feels more acceptable than "pay us more money"

**Viral potential:** Screenshots of fantasy UI will get shared. "Check out this app that treats subscriptions like an RPG"

**Aligns with product:** Planning software = quest planning. Features = quests. Development = adventuring.

**Nostalgia:** Taps into EQ/WoW/RPG nostalgia for 30-40 year old product managers (your target demo)

---

## Next Steps

1. Get feedback on tone/theme intensity
2. Start with Phase 1 (terminology swap)
3. A/B test fantasy vs traditional on pricing page
4. Measure engagement metrics (time on site, upgrade rate)
5. Iterate based on user response

---

**Status:** Brainstorm complete, ready for review and prioritization.
