# Deep dive: playbooks and firm packs

In firm language: playbooks are **engagement briefs** (job packets); firm packs are **practices** you put on retainer. Neither creates a new ACP agent or chatbot.

**Code:** `schemas/playbooks.py`, `schemas/firm_packs.py`, `api/routes/playbooks.py`, `api/routes/firm_packs.py`  
**History:** [`../platform/composable-crew-roadmap.md`](../platform/composable-crew-roadmap.md) (A–E done) · **Persona:** [`../brand/persona-the-firm.md`](../brand/persona-the-firm.md)

---

## Playbooks

A playbook overlays the Foreman with:

- Default tier / tracks / heal budget  
- Seat include/disable lists  
- Prompt / oracle overlays (`qa_commands`, a11y, monorepo boundaries)  
- Artifact policy (`pr` \| `branch` \| `patch` \| `report`)  
- Optional `stage_graph` metadata for the DAG interpreter  

### API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/playbooks` | List system + org playbooks |
| `GET` | `/v1/playbooks/{id}` | Detail |
| `POST` | `/v1/playbooks` | Create org playbook |
| `PATCH` | `/v1/playbooks/{id}` | Update |
| `DELETE` | `/v1/playbooks/{id}` | Delete |
| `POST` | `/v1/playbooks/run` | Resolve playbook → submit task |

Submit also accepts `"playbook": "<slug>"` on `POST /v1/tasks`.

### Built-in verticals

| Slug | Intent |
|------|--------|
| `platform-backlog` | Small backlog items, tier-1 default |
| `a11y-remediation` | Accessibility oracle overlay |
| `monorepo-slice` | Package-boundary tracks |

See [`../verticals/README.md`](../verticals/README.md).

---

## Firm packs

Packs group **roles + default playbooks** for org install and daily quota.

Examples: `swe-factory@1`, `migration-runner@1`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/packs` | Catalog + org install state |
| `GET` | `/v1/packs/{pack_ref}` | One pack |
| `POST` | `/v1/packs/{pack_ref}/install` | Install / re-enable; seed system playbooks |
| `PATCH` | `/v1/packs/{pack_ref}` | `{ "enabled": false, "max_tasks_per_day": 50 }` |
| `DELETE` | `/v1/packs/{pack_ref}` | Remove install row |

Brand term: **practice** (not “bot pack”).

---

## Hard rules

| Rule | ID |
|------|----|
| Still one ACP citizen | **C1** |
| No chat-bot marketplace | **P2** |
| New roles need Temporal registration | **P3** |
| Verticals = config, not engine forks | **M4** |

---

## SDK

Python / TypeScript SDKs expose `playbooks.run` and pack helpers where implemented — always over `/v1/*`.
