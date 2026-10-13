# Frontend design guidelines — Operator identity (silicon firm workplace)

**Audience:** product design + `apps/web`  
**Brand lock:** [`persona-the-firm.md`](./persona-the-firm.md) · [`voice-and-look.md`](./voice-and-look.md)  
**North-star feeling:** *the future of the workplace for silicon engineering teams* — a retained digital firm whose people show up, take seats, and ship artifacts.  
**Code today:** pipeline dots, lavender role tints (`agentTheme.ts`), pixel-dust blobs (`ChibiAvatar`), Lucide on Team — **starting point, not the destination**.

---

## Verdict

We need a real **avatar identity** — memorable Operators who feel like colleagues in a next-gen firm — **not** dry icon tiles, **not** Muse/Grok chibi pets, **not** OpenAI companion Dots.

| Pattern | Use? | Notes |
|---------|------|--------|
| **Operator portraits** | **Yes — primary identity** | Crafted role-distinct avatars; the face of the firm’s staff |
| **Engagement floor / roster sequence** | **Yes — how they appear together** | Who’s in the room for this job, in stage order |
| **Presence field** (glow, focus ring, desk light) | **Yes — secondary** | Deep work / waiting on you / done |
| Status pip alone | Support only | Never the whole identity |
| OpenAI-style free Dots as the agent | **No** | Ambient pets, not workplace identity |
| Multi-agent chibi / collectible cast | **No** | Toy franchise; wrong register |
| Lucide-only squircle tiles | **Too thin** | Fine for dense tables; not the brand face |

**One sentence:** Each seat is an **Operator** with a crafted portrait; a run shows them as a **staffed engagement floor** — the future workplace of a silicon firm, not a chat zoo.

---

## Positioning the look

### What we’re designing for

Gantry’s UI should feel like walking into the firm’s **engagement floor**:

- You filed a work order (run).
- The Foreman staffed the room.
- Operators take their seats in order, work in parallel where the plan allows, pause when they need your sign-off, and leave a deliverable on the table.

Aspiration: **prestige digital workplace** — calm materials, intentional motion, distinctive people — not enterprise grey, not Discord anime squad, not floating orb companions.

### Emotional register

| Want | Avoid |
|------|--------|
| Competent colleagues you’ll retain | Cute pets you’ll collect |
| Presence & focus (“in deep work”) | Bounce / idle dance loops |
| Craft, material, light | Clip-art icons as the hero |
| One firm, many specialists | N bot franchises |
| Future of work | Retro office clipart *or* pure sci-fi HUD clutter |

---

## Canonical identity: the Operator portrait

Every Temporal seat gets a durable **Operator** — a designed avatar, not a generic glyph.

### Portrait anatomy

```
        ╭──────────╮
       ╱  presence  ╲     ← soft field when active (desk light / focus)
      │   ┌──────┐   │
      │   │ bust │   │     ← silhouette + role costume language
      │   │ +    │   │
      │   │ tool │   │     ← one signature prop in-frame (not a floating Lucide)
      │   └──────┘   │
      │   role name  │     ← always legible nearby in roster
       ╲  firm rim  ╱     ← shared metal/glass bezel = same employer
        ╰──────────╯
```

| Layer | Spec |
|-------|------|
| **Bezel** | Shared firm frame (thin glass/metal rim, same radius language) — *same employer* |
| **Bust** | Stylized upper-body / head+shoulders **silhouette** — humanoid enough to read as a colleague, abstract enough to stay “silicon,” not a cartoon face franchise |
| **Signature** | One role-defining prop or motif *integrated into the portrait* (plan slate, wrench rail, shield facet, ship chevron, a11y eye-mark…) |
| **Material** | Soft matte body + subtle refractive edge; lavender firm atmosphere; Foreman slightly richer (deeper rim / denser presence) |
| **Presence field** | When `active`: quiet luminance behind/around the bezel (“desk light on”). When `blocked` (HITL): amber hold. When `done`: field settles, check etched into rim |
| **Label** | Role title in roster/stream — portrait alone is not enough in dense UI |

### Distinctiveness rules (identity, not decoration)

Each Operator must be recognizable **in silhouette at 24px**:

| Seat | Portrait language (direction, not final art) |
|------|-----------------------------------------------|
| **Foreman** | Centered, broader rim, “managing partner” stillness — firm emblem in chest/bezel |
| **PM** | Brief / slate; questioning posture; open stance |
| **Architect** | Layered planes / blueprint facets; composed profile |
| **Builder** | Tool rail / constructive geometry; can show `×N` for parallel tracks without cloning faces |
| **Inspector** | Optic / gauge motif; precise upright |
| **Reviewer** | Dual-lens / diff motif; evaluative tilt |
| **Security** | Faceted shield; tighter, denser mass |
| **DevOps** | Ship chevron / launch rail; forward vector |
| **Oracle A11y** (pack) | Accessibility mark woven into optic — specialist, still same firm bezel |
| Future pack roles | New silhouette + signature prop; **same bezel system** so they join the firm, not start a spin-off cartoon |

Art direction may be illustration, 3D stills, or generative-consistent assets — but **one system**, versioned like a design kit (`operator-portraits@1`).

### What an Operator is not

- Not a chibi with big eyes and outfit drops  
- Not a nameless gradient orb / Dot  
- Not a bare Lucide icon in a colored circle (except dense secondary UI)  
- Not a photoreal human stock headshot (wrong “silicon” register)  
- Not a unique IP character per playbook (playbooks are jobs; Operators are staff)

---

## Sequence = engagement floor

When Operators appear together, they are **who’s on the floor for this engagement** — a living org chart, not a buddy list.

### Default staffing order

```
Foreman → PM → Architect → Builders (wave) → Inspector → Reviewer → [pack specialists] → Security → DevOps
```

### Floor layouts

**1. Roster rail (run console — primary)**  
Vertical or horizontal strip of portraits in stage order. Active Operator gets presence field; others dim slightly. Status line under the active seat (“Running oracle checks”, “Waiting on plan approval”).

**2. Engagement header strip**  
Compact portraits + role short codes; Builder collapses to one portrait + `×3`. Foreman pinned left as firm anchor.

**3. Floor map (optional, aspirational)**  
A single calm “floor plate” graphic: seats around a worktable / spine. Occupied seats light as the plan advances. Use sparingly (empty state, pack overview) — don’t make every run a video game map.

**4. Stream attribution**  
Small portrait + role name on each firm event. Presence dust (evolved pixel-dust) may live *inside* the bezel when “speaking” in the log — texture, not a second avatar system.

### Sequence rules

1. Order = execution plan / stage graph.  
2. Parallel Builders = **one** Builder Operator + count, or a tight stack of bezels with one face — never three unrelated mascots.  
3. Heal loops don’t spawn new characters; Inspector/Reviewer presence intensifies, Builder returns to the floor.  
4. Skipped seats: portrait present but desaturated (“not staffed this engagement”).  
5. HITL: that Operator turns toward the user (hold state) — *they’re waiting on the client*, firm metaphor intact.  
6. Only **one** primary presence field at a time (plus Foreman always quietly lit).

---

## Motion language (workplace, not toys)

| State | Motion |
|-------|--------|
| Idle on floor | Near-still; optional 1–2% material shimmer |
| Active / deep work | Presence field breathes slowly; micro tool hint |
| HITL / blocked | Field shifts to hold color; subtle “awaiting client” pulse |
| Done | Field collapses; rim check |
| Fail / heal | Brief tighten, then Builder/Inspector re-engage — no comic shake |

Ship **2–3 intentional motions** per surface (presence on, hold, complete) — not a roster of idle dances.

---

## Surfaces

| Surface | Treatment |
|---------|-----------|
| **New run** | Preview the staffed floor for the selected playbook — portraits at rest |
| **Active run** | Live engagement floor; Foreman + active Operator emphasized |
| **Team** | Firm directory: large portraits, role, what they do, mute/include — *employee handbook*, not character wiki |
| **Packs** | Practice door card + the Operators that practice employs (portrait row) |
| **Marketing / first paint** | Firm wordmark + Foreman + a short roster silhouette — “your silicon engineering team,” not “meet the bots” |
| **Dense tables / diffs** | May fall back to mini-portrait or seal; full portrait remains the brand face elsewhere |

---

## Relationship to rejected patterns

| Pattern | Why we reject as *identity* | What we steal (if anything) |
|---------|-----------------------------|-----------------------------|
| **Chibis** | Collectible pets; consumer chat | Crafted distinctiveness, role-readable silhouettes |
| **OpenAI Dots** | Companion presence without workplace | Soft presence fields *around* a portrait |
| **Lucide seals** | Dry; fails “future workplace” | Clarity of role labeling; use in dense UI only |
| **Pixel-dust blobs** | Anonymous; no colleague read | Evolve into **in-bezel presence texture** when an Operator is “on mic” in the log |

---

## System requirements (so it stays a firm)

1. **Shared bezel / material system** — every Operator looks employed by Gantry.  
2. **Role silhouette kit** — new pack roles extend the kit; they don’t invent a new art genre.  
3. **Portrait asset contract** — `role_id → portrait (svg/webp) + presence color + signature motif`; register next to Temporal role (P3: no fake faces without real seats).  
4. **Accessibility** — name in text; don’t encode role only in color; respect `prefers-reduced-motion` (static presence OK).  
5. **No playbook-only mascots** — playbooks change staffing and costumes props, not a separate cartoon company.

---

## Migration path

| Now | Next |
|-----|------|
| Lucide Team icons | Interim seals → replace with Operator portraits on Team / Packs first |
| `PipelineTracker` dots | Become presence pips on / under portraits |
| `ChibiAvatar` dust | Re-home as in-bezel presence when Operator is active in the feed; stop using as sole face |
| `AGENT_ROLE_COLORS` | Map to presence fields + signature accents on portraits |
| Copy “agents deployed” | “On the floor” / “Staffed for this engagement” |

Phase the art: **v0** silhouette+prop portraits (2D), **v1** richer material/light, **v2** optional floor map. Don’t ship chibis as a waypoint.

---

## Acceptance checks

1. **Workplace test:** First glance says “digital firm staffed a room,” not “chat app cast” or “settings icon row.”  
2. **Silhouette test:** At 24px, PM ≠ Builder ≠ Security without reading the label.  
3. **Employer test:** All portraits share the firm bezel; a new pack role still looks hired, not franchised.  
4. **Job test:** Sequence matches the engagement plan; deliverable remains the hero outcome.  
5. **Anti-pet test:** No outfit gacha, no buddy names, no Dot-only identity.

---

## Summary

**Avatar identity = Operator portraits** — stylized silicon colleagues with role-true silhouettes, signature props, and a shared firm bezel.  
**Sequence = engagement floor** — who’s staffed, in plan order, with workplace presence (desk light / hold / done).  

That is the future-of-work face of Gantry: **a firm’s people showing up to do the job** — richer than icon tiles, more serious than chibis, more human than Dots.
