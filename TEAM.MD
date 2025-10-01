# Coda CLI – Development Team

Coda CLI is built and maintained using an **agent-inspired team structure**.  
Each area of responsibility is mapped to a role (“Agent”), mirroring the way Coda orchestrates agents and workflows.  
This keeps our development cycles clear, minimal, and scalable.

---

## Guiding Principles

- **Minimalism first**: clarity over complexity.  
- **Portable by design**: works locally, on GPU rigs, or in the cloud.  
- **Contributor-friendly**: small mental model, low barriers to entry.  
- **Transparent workflows**: every change is auditable and reproducible.  

---

## Agent Roles

### 🧭 Architect Agent
- Defines vision, roadmap, and architecture.
- Aligns new features with **minimal, portable, scalable** goals.  
- **Inputs**: roadmap, community feedback.  
- **Outputs**: prioritized backlog, architecture docs.

---

### 🛠 Builder Agent
- Implements core CLI commands and features.  
- Integrates Typer, Docker SDK, schema validation, Rich logging.  
- **Inputs**: feature specs, backlog tasks.  
- **Outputs**: working code, merged features.

---

### ✅ Test & Quality Agent
- Ensures correctness and stability.  
- Builds unit tests, e2e Docker tests, CI pipelines.  
- **Inputs**: PRs, new code.  
- **Outputs**: validated builds, coverage reports.

---

### ⚙️ Infra Agent
- Manages cross-environment portability.  
- Handles Docker contexts, GPU integration, and config layering.  
- **Inputs**: environment needs.  
- **Outputs**: install guides, portability fixes.

---

### 💡 DX (Developer Experience) Agent
- Improves usability for contributors and users.  
- Adds structured logs, autocomplete, helpful errors, examples.  
- **Inputs**: contributor feedback.  
- **Outputs**: recipes (GPU, secrets, workflows), DX features.

---

### 📖 Docs Agent
- Maintains project communication and guides.  
- Updates README, TEAM, tutorials, FAQs.  
- **Inputs**: new features, roadmap updates.  
- **Outputs**: clear docs, updated guides.

---

### 🌐 Community Agent
- Connects with contributors and users.  
- Triages GitHub issues, surfaces feature requests, manages discussions.  
- **Inputs**: issues, PRs, feedback.  
- **Outputs**: curated backlog, RFCs, onboarding support.

---

## Agent Workflow

1. **Architect Agent** sets direction.  
2. **Builder Agent** implements features.  
3. **Test Agent** validates correctness.  
4. **Infra Agent** ensures portability.  
5. **DX Agent** polishes ergonomics.  
6. **Docs Agent** communicates updates.  
7. **Community Agent** gathers input → loops back to Architect.  

This forms a **minimal orchestration loop**, just like the tool itself.

---

## GitHub Labels Mapping

Use labels to match issues/PRs to agents:

- `arch` → Architect Agent  
- `build` → Builder Agent  
- `test` → Test & Quality Agent  
- `infra` → Infra Agent  
- `dx` → Developer Experience Agent  
- `docs` → Docs Agent  
- `community` → Community Agent  

---

## How to Contribute

1. Look for issues tagged with an **Agent label**.  
2. Comment to take ownership.  
3. Submit a PR linked to the issue.  
4. The relevant Agent domain will review and merge.  

---

## Long-Term Vision

This team structure is intentionally **minimal and scalable**.  
New roles (e.g., Security Agent, Workflow Agent) can be added as needed, while preserving the same simple orchestration cycle.

---
