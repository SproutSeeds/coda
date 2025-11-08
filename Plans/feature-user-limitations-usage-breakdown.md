# Plan: Transparent Usage Breakdown UI

## Goal
Expose every billable action and storage class transparently. Each category (Creation, Collaboration, Delivery, Authentication, Analytics, Dev Mode, Storage) gets its own collapsible panel showing every action we price, even if unused, with unit pricing, current usage, and projections ($5/$20/$100).

## Steps
1. **Data Model Enhancements**
   - Extend `COST_MODEL` entries with human-readable category + description.
   - Ensure analytics payload emits all actions from the model, even if quantity/cost is zero. Include helper that calculates “units purchasable” for $5/$20/$100.
   - Include storage pricing metadata alongside action model for consistent handling.

2. **Server Aggregation**
   - Update `getUserUsageDashboard` to merge cost-model defaults with actual usage logs, returning per-action details (quantity, total cost, last occurrence) for every action.
   - Provide category → action mapping so the client can group rows.
   - Emit precomputed $5/$20/$100 projections per action.

3. **Client UI Structure**
   - Replace the single “Cost reference” card with one collapsible panel per category (Creation, Collaboration, Delivery, Authentication, Analytics, Dev Mode, Storage).
   - Each panel lists the actions with:
     - Color chip, action name, tooltip icon.
     - Lifetime spend + quantity.
     - Inline tooltip showing unit cost formula + sample projections.
     - Example “$5 buys X units / Y GB” style chips.
   - Panels should all reuse a shared accordion component for consistency.

4. **Tooltips & Projections**
   - Build a reusable tooltip component (shadcn Popover/Tooltip) to display the cost formula and projections.
   - Precalculate projections server-side to keep the UI simple.

5. **Mobile / Accessibility**
   - Ensure accordions collapse appropriately on small screens (stacked layout, large tap targets).
   - Provide aria-expanded states and meaningful button labels per category.

6. **Validation**
   - Seed fixture data (or point to provider-sync) to confirm non-zero costs render correctly.
   - Add unit tests for cost-model merge logic and projection calculations.
   - Manual QA: light/dark modes, mobile view, all panels collapsed/expanded.
