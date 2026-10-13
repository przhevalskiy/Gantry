# Frontend design guidelines — representing the firm’s staff

**Audience:** product design + `apps/web`  
**Brand lock:** [`persona-the-firm.md`](./persona-the-firm.md) · [`voice-and-look.md`](./voice-and-look.md)  
**Code today:** pipeline stage dots (`PipelineTracker`), lavender role tints (`agentTheme.ts`), pixel-dust blobs (`ChibiAvatar` — name legacy), Lucide role icons (Team page).

---

## Verdict (choose this)

| Pattern | Use? | Role |
|---------|------|------|
| **Staff marks** (role seals / badges) | **Yes — primary identity** | Who is staffed on the engagement |
| **Roster sequence** (ordered strip) | **Yes — primary sequence** | Firm staffing order = stage graph |
| **Status dots / pulses** | **Yes — secondary presence** | Active / waiting / done (not personality) |
| **OpenAI-style free Dots as agent identity** | **No** | Reads as companion swarm, not a firm |
| **Multi-agent chibi characters** | **No** (primary UI) | Reads as collectible pets / Muse-Grok energy |
| **Pixel-dust blobs** | **Legacy / demote** | OK as optional motion texture behind a seal; not the face of the firm |

**One sentence:** Agents under the firm are shown as a **staffed roster of role seals in engagement order**, with quiet status — not a parade of chibis or a constellation of personality dots.

---

## Why not chibis or Dots?

| Approach | What it signals | Conflict with brand |
|----------|-----------------|---------------------|
| Multi-agent chibis | Cute cast you collect and befriend | Firm = professional services, not pets |
| OpenAI Dots (as identity) | Ambient companions / chat presence | Product unit is a **job**, not a conversation |
| Role seals + roster | Office staffing board / practice roster | Matches “retain a firm, file a work order” |

Dots are fine as **traffic lights on a seal** (pending / active / done). They must not *be* the agent.

---

## Canonical representation: Staff mark

Each Temporal seat (PM, Architect, Builder, …, Oracle A11y, DevOps) gets a **staff mark**:

```
┌─────────┐
│  [icon] │  ← Lucide (or mono glyph), 16–20px
│   PM    │  ← role short label
└─────────┘
   ● idle   ← optional status pip (not the avatar)
```

### Anatomy

| Part | Spec |
|------|------|
| Shape | Squircle / 10–12px radius tile, **not** a face circle as the hero |
| Icon | Functional Lucide (Clipboard, Layers, Wrench, Shield, …) — same family as Team page |
| Color | Role tint from a **cohesive firm palette** (lavender family OK); Foreman slightly stronger |
| Label | Role name always available (tooltip or adjacent text) — never icon-only in primary roster |
| State | Pip or ring: `pending` · `active` · `blocked` (HITL) · `done` · `skipped` |
| Motion | Active = soft breath on pip or 1px ring; **no** bounce-idle mascot loops |

### Sizes

| Context | Mark size | Sequence |
|---------|-----------|----------|
| Run rail / Crew panel | 28–32px tile | Vertical roster |
| Run header / compose chip | 20–24px | Horizontal strip, max ~7 visible + “+N” |
| Stream row (who spoke) | 18–20px | Single mark + role label |
| Pack / Team catalog | 32–40px | Grid of seals, not character cards |

---

## Avatar sequence = staffing roster

The sequence is the **engagement org chart for this run**, aligned with the Foreman stage plan — not a social feed of friends.

### Default order (classic firm)

```
Foreman  →  PM  →  Architect  →  [Builders…]  →  Inspector  →  Reviewer  →  (Oracle*)  →  Security  →  DevOps
```

\* Pack roles (e.g. `oracle_a11y`) insert where the playbook `stages[]` place them.

### Rules

1. **Order follows the execution plan** (stage graph), not alphabetical or “favorites.”
2. **Collapse the heal core** visually as one group when useful: `Build & verify` containing Builder / Inspector / Reviewer — mirrors `build_verify` in the engine.
3. **Parallel builders** = one Builder seal + count badge (`×3`), not three chibi twins.
4. **Skipped / muted seats** = ghosted seal (low opacity), still in roster if the playbook listed them — honesty about staffing.
5. **Foreman** is the firm mark: first or pinned; never just another peer in a pet lineup.
6. **Do not** animate the whole roster as a dancing cast when a run starts. Advance state on the active seat only.

### Horizontal strip (compact)

```
[Firm]  PM — Arch — Build×2 — Insp — Rev — Sec — DevOps
              └ active pip
```

Use for run headers. Prefer separators / hairlines over chat-bubble stacking.

### Vertical roster (run console)

Preferred in Crew / Agent rail: seal + label + one-line status (“Running tests”, “Waiting plan approval”).

---

## Presence vs identity

| Layer | Visual | Example |
|-------|--------|---------|
| **Identity** | Staff mark (icon tile + role) | “Inspector” |
| **Presence** | Status pip / thin progress | Pulsing pip while inspector child workflow runs |
| **Voice-of-log** | Optional dust/shimmer **behind** seal | Legacy pixel-dust only as texture, never alone |

Thinking indicators in the log may keep three small dots — that is **system typing**, not an agent persona.

---

## Surfaces — what to show where

| Surface | Representation |
|---------|----------------|
| **New run / compose** | Optional mini roster preview from selected playbook stages (static seals) |
| **Active run** | Live roster sequence + active pip; Foreman pinned |
| **Team page** | Staff directory: seals + role copy + include/mute — **not** character bios |
| **Packs page** | Practice card lists role **names** (and optional tiny seal row); no mascot squad |
| **Message / activity feed** | Per-event staff mark + role label; avoid large chibi column |
| **Marketing / empty states** | One firm mark + short roster silhouette; never “meet the gang” hero |

---

## Explicit anti-patterns

1. **Chibi lineup** as the hero of the product (multi-character cast with faces/outfits).
2. **Dot-only agents** with no role label (OpenAI Dots as the crew).
3. **Per-playbook cartoon mascot** implying a separate bot firm.
4. **“Agents deployed” toy language** without firm framing — prefer “Staffed · N of M seats” or “Engagement roster.”
5. **Random pastel face circles** that could belong to any chat app after removing the wordmark.

---

## Migration from current UI

| Current | Direction |
|---------|-----------|
| `PipelineTracker` stage dots | Keep as **status pips**; pair each with a staff mark + label |
| `ChibiAvatar` pixel-dust | Demote to optional active-state texture; rename mentally to “presence dust,” not chibi |
| `AGENT_ROLE_COLORS` | Keep cohesive lavender firm tints; bind to seals, not blob faces |
| Team page Lucide icons | **Promote** — this is the closest to the target staff mark |
| Copy “agents deployed” | Shift to “seats staffed” / “roster” |

---

## Acceptance checks

A frontend change passes the firm test if:

1. Removing the Gantry wordmark, you still read **staffing board**, not **chat pets**.
2. A new pack role (e.g. Oracle A11y) gets a seal + roster slot, not a new character franchise.
3. Parallel builders don’t multiply into a crowd of mascots.
4. Active work is obvious from **one** highlighted seat, not a party of bouncing avatars.

---

## Summary

**Represent the firm’s agents as an ordered roster of role seals (staff marks) with quiet status pips.**  
Use dots for state, Lucide-style icons for role identity, sequence for the engagement plan.  
**Do not** use multi-agent chibis or OpenAI-style identity dots as the face of the crew.
