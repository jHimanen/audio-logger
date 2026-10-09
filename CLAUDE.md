# CLAUDE.md

Audio logger: record Finnish speech in the browser, transcribe it, save it as Markdown.
Backend Python/FastAPI, frontend React/Vite/TS. Language-agnostic by design, Finnish first.

## Read first

- `ARCHITECTURE.md` – components, interfaces, data model, decision log. Update the decision log
  when a technical choice changes.
- `ROADMAP.md` – stages and task checklists. Tick tasks as they land.

## Principles

- **Simple over clever.** Prefer the straightforward solution; add abstraction only at the seams
  named in ARCHITECTURE.md (`TranscriptionProvider`, `NoteRepository`, `ProcessingService`).
  No speculative infrastructure for stages that have not started.
- **Efficient code.** Avoid needless copies, round-trips and dependencies. One good library beats
  three small ones.
- **History lives in git, not in comments.** Explain *why* in commit messages and PR descriptions.
  Code comments only where the code cannot speak for itself.

## Workflow

- **Docs and meta** (ARCHITECTURE.md, ROADMAP.md, this file, configs): small changes go straight
  to `main`.
- **Code changes:** branch, then PR with a professional description: what changed, why, how it was
  verified, anything deferred. Commit messages follow the same standard.
- **Implementation plans:** list tasks with their dependencies explicitly. Mark tasks that are
  independent so they can run in parallel in separate worktrees.
- **PR review:** when a PR is ready, spawn a fresh subagent (no prior context) to review it.
  Focus: correctness, simplicity, and whether it meets the stated requirements without
  over-engineering. Address findings before merging.

## Tooling

- Backend: `uv` for env and lockfile, `ruff` for lint and format, `pytest` for tests.
- Frontend: Vite + React + TypeScript. All visible strings go through `t()` and `locales/<locale>.json`.
- `notes/` and `.env` are gitignored user data and secrets; never commit them.
