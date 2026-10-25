# AGENTS.md — working contract for code agents

> This file is the binding contract for any code agent (Claude Code, Cursor, Windsurf, Copilot) working in this repo.
> This is a **BringUp internal project**: **customer journey V3** — BringUp's lead process with an external sales rep, run on the monday CRM. What the system does: see [README.md](README.md).
> It succeeds the `dafna` repo (`bringup123/dafna`, the AI caller — **stopped on 2026-10-25**) and stands beside `bringup123/bringup-journey` (Sagi's earlier full-journey spec, simulator only). **This repo imports nothing from either**; what it reuses is copied once and owned here.

---

## Map of sources of truth

| File | Role |
|---|---|
| `STATUS.md` | Project state: current stage, in progress, next up, blockers. **The single source of truth for state.** |
| `TASKS.md` | Task queue: waiting / in progress / done. |
| `CONTEXT.md` | Domain glossary. The canonical meaning of every project term. **Read before writing code.** |
| `CHANGELOG.md` | Readable change history (understandable to a non-technical reader). |
| `spec/` | Sagi's briefs, verbatim — **read only**. `spec/sagi-brief-2026-10-25.md` is V3's origin. |
| `docs/README.md` | **The index of `docs/`.** One line per document; look here first. |
| `docs/ARCHITECTURE.md` | What runs where: monday, ManyChat, cal.com, and the service (not built yet). |
| `docs/INTEGRATIONS.md` | Concrete facts about the external systems: board and column ids, labels, webhooks, ManyChat tags and flows, cal.com. Check here before guessing at an API. |
| `docs/SETUP.md` | Access and credentials: which keys exist, where they live, what this repo needs. |
| `docs/DECISIONS.md` | Log of architectural and product decisions, newest first. |
| `.env.example` | Names of all environment variables with explanations (never values). |

---

## Opening a session — mandatory before any work

1. Read `STATUS.md`.
2. Read `TASKS.md` — what is waiting and what is in progress.
3. Read `CONTEXT.md` — the domain vocabulary.
4. Read the last 3 entries in `CHANGELOG.md`.
5. Run `git log --oneline -10` and `git status`.
6. Summarise for the user in 2–4 lines: what stage the project is at, what is in progress, which tasks are open.

**Do not write or change code before completing these steps.**

---

## Closing a session — mandatory at the end of any work

1. Update `STATUS.md`: what was completed, what is in progress, what is next, any new blockers, the date.
2. Update `TASKS.md`: the state of tasks touched.
3. Add an entry to `CHANGELOG.md`.
4. Commit and push to the working branch.

**A session where `STATUS.md` and `CHANGELOG.md` were not updated is not closed.**

---

## Working on tasks — TASKS.md

- Tasks are maintained **by hand**. The agent does not add tasks to *waiting* on its own — ideas and proposals are put to the user.
- Before starting: move the task to **in progress**. One task at a time.
- Work is measured against the task's **acceptance criteria**. A missing or unclear criterion → ask before, do not guess.
- On completion: move to **done** with a reference to the commit, and update `CHANGELOG.md` and `STATUS.md`.
- A blocked task → back to **waiting** with a blocking note, and the blocker in `STATUS.md`.

---

## While working

- **An architectural or product decision** → an entry in `docs/DECISIONS.md` at that moment.
- **A new domain term, or a term whose meaning shifts** → `CONTEXT.md` at that moment.
- **A new environment variable** → `.env.example` (name + explanation + where to obtain it) and `docs/SETUP.md`.
- **A new board column, label, automation, webhook, template or flow** → `docs/INTEGRATIONS.md`, with its id.
- **A new document** → into `docs/`, with a line in `docs/README.md`.
- **Overriding principle: knowledge not written in the repo does not exist.**

---

## Safety rules — this project reaches real people

The CRM board is the real one (1753447162) and every Lead on it is a real person. There is no test board for V3 yet.

1. **Nothing reaches a Lead without Sagi's wording.** Every message V3 sends is one of the texts in `spec/`, or a change he approved in writing.
2. **One switch per message, off by default.** A message is built, proved on an allowlisted handset, and only then switched on.
3. **Board changes are additive.** No existing column or label is renamed or deleted without the user's explicit agreement recorded in `docs/DECISIONS.md` — other systems (the dafna service, ManyChat, Make) read them by name.
4. **Ask before acting on anything outside this repo** (switching an automation off, a webhook, a template, a calendar event type), and record what was done with its id.
5. **Never commit a credential.** `.env*` is ignored; values live in the environment, not in files that are pushed.

---

## Git

- **No direct push to `main`.** Work in branches: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.

---

## Language

The repo is **English**, including code, comments and docs — even though the board and every message are Hebrew. Exceptions: `spec/` (Sagi's words, verbatim) and any document written for a Hebrew reader outside the project, which says so at its top.
