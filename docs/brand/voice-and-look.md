# Voice and look + feel

## Voice

### Principles

1. **Factory / firm language over chat language** — runs, jobs, packs, playbooks, artifacts.
2. **Concrete outcomes** — name the deliverable (`branch`, `PR`, `report`).
3. **Honest architecture** — one factory; specialists are staffed, not “deployed as bots.”
4. **Operator-respecting** — short, scannable, no mascot whimsy in primary UX.

### Preferred vocabulary

| Prefer | Avoid |
|--------|--------|
| Run, job, engagement | Chat, conversation (as the product unit) |
| Playbook, job packet | Prompt persona, bot profile |
| Firm pack, practice | Bot pack, agent marketplace |
| Team / crew / seats | Friends, companions, characters |
| Artifact, deliverable | Reply, message (as success) |
| Foreman / factory | Swarm of independent agents (as the product) |
| Install pack / enable practice | Deploy bot / launch personality |

Chat UI copy may still say “message” for stream rows — frame as **run log / observability**, not the domain model.

### Tone

- Calm, precise, slightly formal (professional services).
- Confident without AGI theater.
- Errors: actionable (“firm pack disabled — enable via /packs”), not cute.

### UI surface names (canonical)

| Surface | Label | Role in brand |
|---------|-------|----------------|
| Compose | New run | File a work order |
| Runs | Runs | Matter list |
| Packs | Packs | Practice catalog |
| Team | Team | Staffing / defaults |
| Playbooks (API) | Playbooks; UI may say Skills | Engagement briefs |
| Developer | Gantry API | Integrator docs |

---

## Look + feel

Source of truth for tokens: `apps/web/src/design/tokens.css`, `apps/web/src/index.css`.

### Visual direction

| Element | Direction |
|---------|-----------|
| Mood | Light, calm ops console — “retained firm,” not neon cyber |
| Shell | Soft lavender wash / gradient (`--shell-bg`, `--shell-gradient`) |
| Panels | White, large radius (~16–20px), soft violet-tinted shadow |
| Type | **Albert Sans** — clean product sans, not editorial serif |
| Accent | Lavender interactive (`--accent-500` ≈ `#8b7cf6`) |
| Primary CTA | Near-black pill (`--cta-primary-bg` ≈ `#111827`) on light UI |
| Density | Console-comfortable; avoid dashboard clutter on first run screen |

### Brand hierarchy in UI

1. **Wordmark “Gantry”** in shell — firm identity.
2. **Run / packs / team** as primary nav — work vocabulary.
3. Streaming / bubbles — secondary; they observe the engagement, they are not the product logo.

### Do

- Lead marketing and empty states with **goal → artifact** and **packs / playbooks**.
- Keep CTAs high-contrast black-on-light for submit / install.
- Use firm language on `/packs` and Team (“practice,” “staffed roles,” “job packet”).

### Don’t

- Position the product as a cast of collectible avatars.
- Lead with purple glow, dark-mode neon, or “chat with your agents” hero copy.
- Let message bubbles overpower the brand on first paint (nav-only branding fails the brand test).
- Imply each playbook is a separately hosted bot firm.

### Tension to manage

Docs and brand say **factory / firm**. Parts of the web app still *look* chat-shaped. Treat that as **run observability chrome**, and migrate copy/layout toward run-console semantics whenever touching those surfaces.

### Agent / staff visuals

Do **not** use multi-agent chibis or OpenAI-style identity dots as the crew. Use an ordered **staff roster of role seals** with status pips. Full rules: [`frontend-agent-representation.md`](./frontend-agent-representation.md).
