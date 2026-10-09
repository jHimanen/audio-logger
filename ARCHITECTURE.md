# Architecture

> Living document. Written together during the planning stage.
> Last updated: 2026-10-09 (Stage 1 implemented)

## 1. Purpose

A web app for capturing spoken notes: the user starts a recording with a button or key press,
speaks, pauses/resumes or stops, and the speech is transcribed into text that can be edited or
saved. The first language is Finnish; the system must make adding other languages cheap.

## 2. Guiding constraints

- **Finnish first, language-agnostic design.** No hard-coded language anywhere except a single
  config value. UI strings, transcription language and post-processing prompts are keyed by
  locale.
- **MVP is local.** Markdown files on disk, no database, no deployment, single user, no auth.
- **Clear seams for later stages.** Storage, transcription and post-processing sit behind
  interfaces so they can be swapped (files -> DB, vendor A -> vendor B) without touching the UI
  or the routes.
- **No speculative infrastructure.** Nothing is added for a stage that has not started
  (see the Rust decision in 3.5).

## 3. High-level components

```
Browser (React)  --audio/webm-->  FastAPI backend  --audio-->  ElevenLabs Scribe v2 (STT)
      ^                               |   ^
      |<------- Note JSON ------------+   |
                                          +--> notes/<id>/{note.md, audio.webm, meta.json}
                                          +--> Claude API (post-processing modes, Stage 4)
```

### 3.1 Frontend – React (Vite, TypeScript)
- Captures audio with `MediaRecorder` (`audio/webm;codecs=opus`), posts the blob to the
  backend, renders the returned transcript.
- React chosen over vanilla TS so Stage 3 (editing) and Stage 4 (modes) need no migration.
  Overkill for the MVP; accepted trade-off.
- Vite dev server proxies `/api` to FastAPI (`127.0.0.1`, not `localhost`); in production FastAPI
  serves `frontend/dist`. No SSR.
- **Chrome/Chromium only** until deployment. The backend still stores the browser-reported MIME
  type in `meta.json` so Safari (MP4/AAC) can be added later without a migration.
- Controls: one large record button; **Space** toggles start/stop when focus is not in an
  editable element; **Escape** cancels the recording without saving. Pause/resume (Stage 2)
  uses `MediaRecorder.pause()` / `resume()`, which yields one continuous file.
- UI state machine: `idle -> recording -> (paused <-> recording) -> uploading -> transcribing -> done | error`.

### 3.2 Backend – Python 3.12+ / FastAPI
- Receives recorded audio, calls the STT provider, persists the note, serves the frontend.
- Chosen over Node/TS because the author is strongest in Python and wants the option of local
  ML (Whisper, diarisation) later.
- Tooling: **uv** (env + lockfile), **ruff** (lint + format), **pytest**. Settings via
  `pydantic-settings` from environment / `.env`.
- Layering:
  ```
  routes/        FastAPI routers, request/response models only
  services/      orchestration: record -> transcribe -> save
  providers/     TranscriptionProvider implementations (elevenlabs.py, fake.py for tests)
  storage/       NoteRepository implementations (filesystem.py)
  i18n/          locale loading for prompt templates (added with Stage 4; no backend strings before)
  ```

### 3.3 Transcription – ElevenLabs Scribe v2, behind an interface
- Anthropic offers no speech-to-text (verified 2026-10-09), so the vendor is external.
- Batch mode: upload the whole recording after *stop*, receive text. Streaming transcription is
  deferred until there is a UX need for live text.
- `TranscriptionProvider.transcribe(audio: bytes, mime: str, language: str) -> Transcript`.
  Language is always passed explicitly (`fi`); vendor auto-detect is not used.
- A `FakeTranscriptionProvider` returns canned text so the full flow is testable offline.

#### Vendor survey (2026-10-09)
No independent Finnish-specific benchmark exists; figures are vendor claims and third-party
price listings. Finnish is agglutinative, so WER is harsher than for English.

| Vendor / model | Finnish | Batch price (per audio hour) | File limits | Notes |
|---|---|---|---|---|
| **ElevenLabs Scribe v2** | Yes, "Excellent" tier (<=5 % WER claimed) | ~$0.22 | 3 GB, 10 h | Word timestamps, diarisation. Cheapest of the shortlist. **Chosen.** |
| OpenAI `gpt-transcribe` | Yes; `languages` + `prompt` params | ~$0.27 | 25 MB | OpenAI's recommended model for new builds; 25 MB cap matters for long notes. |
| Deepgram Nova-3 (`language=fi`) | Yes, monolingual since Nov 2025 | ~$0.26–0.46 (listings conflict) | – | Finnish not in the multilingual model. |
| Google Chirp 3 | Yes | ~$0.36 | – | Heavier GCP setup. |
| Mistral Voxtral Transcribe 2 | **No** | $0.18 | – | Rejected. |
| AssemblyAI Universal-3 Pro | **No** | – | – | Rejected. |

**Decision:** single vendor, ElevenLabs Scribe v2, no bake-off for now. If accuracy
disappoints, a second provider can be trialled on the kept audio (3.6) – see ROADMAP parking lot.

### 3.4 Post-processing – Claude (Stage 4)
- "Modes" (clean-up, summary, bullets, ...) are prompt templates applied to the raw transcript
  via the Claude API, producing `note.md` while the raw transcript stays in `meta.json`.
- Templates live in `backend/prompts/<locale>/<mode>.md`; a mode is defined by its template
  plus a small manifest (name, description, output format).
- Not part of the MVP; model choice and streaming decided when Stage 4 starts.

### 3.5 Rust components (none planned)
Rust was considered for audio preprocessing, but every candidate job disappeared during
planning: pause/resume is handled by `MediaRecorder` (no stitching), the cloud vendor handles
decoding and normalisation, and Chrome-only means one input format. The remaining realistic
entry point is a **local STT provider** via `whisper-rs` behind `TranscriptionProvider`, if
privacy or cost ever demands it. Rule: Rust is added only for a measured bottleneck or a
missing capability, not for practice.

### 3.6 Storage – one folder per note
```
notes/                          # gitignored; root configurable via NOTES_DIR
  2026-10-09T14-32-05Z/         # note id = UTC timestamp, sortable, no collisions in practice
    note.md                     # user-facing text (raw transcript in MVP; edited/processed later)
    audio.webm                  # raw recording, kept permanently
    meta.json                   # see §5
```
- Raw audio is **kept**, so a note can be re-transcribed when the vendor or model changes and
  the editor can replay passages.
- `meta.json` is the future DB row; `note.md` is the document. Stage 5 maps the folder to a
  `Note` record and moves audio to blob storage.
- `NoteRepository` interface: `save(note, audio) -> id`, `get(id)`, `list()`. Filesystem
  implementation in the MVP; the repository owns id uniqueness (collision -> `-2`, `-3` suffix).

## 4. Data flow (MVP)

1. User presses the button or Space. Frontend requests mic permission, starts `MediaRecorder`.
2. User presses again. `MediaRecorder` stops; frontend assembles one `Blob`.
3. Frontend `POST /api/notes` (multipart: `audio`, `mime_type`, `duration_ms`).
4. Backend `NoteService.create()`:
   1. validates size/MIME,
   2. calls `TranscriptionProvider.transcribe(audio, mime, locale)`,
   3. builds `Note` (raw transcript, metadata),
   4. `NoteRepository.save(note)` writes the folder.
5. Backend returns the `Note` JSON. Frontend renders the text and the saved path.
6. Errors (mic denied, upload failed, vendor error) surface as a localised message; on vendor
   failure the audio is still saved so nothing is lost.

Transcription runs synchronously inside the request for the MVP. A recording of a few minutes
transcribes in seconds; if that ever exceeds ~30 s, switch to a job + polling pattern.

## 5. Data model

```jsonc
// meta.json  (== Note record minus the text bodies)
{
  "id": "2026-10-09T14-32-05Z",
  "created_at": "2026-10-09T14:32:05Z",
  "language": "fi",
  "duration_ms": 83210,
  "audio": { "file": "audio.webm", "mime_type": "audio/webm;codecs=opus", "bytes": 412331 },
  "transcription": {
    "provider": "elevenlabs",
    "model": "scribe_v2",
    "raw_text": "...",            // never modified after creation
    "completed_at": "2026-10-09T14:32:09Z"
  },
  "processing": null,             // Stage 4: { "mode": "cleanup", "model": "...", "at": "..." }
  "edited_at": null                // Stage 3
}
```
- `note.md` holds the current user-facing text. In the MVP it equals `raw_text`.
- Invariants: `raw_text` and `audio.webm` are immutable; everything else may change.

## 6. Internationalisation

- One setting, `APP_LOCALE` (default `fi`), read by both backend and frontend
  (`GET /api/config` exposes it). It is the only place a language is named.
- **UI strings:** `frontend/src/locales/<locale>.json`, loaded by a thin `t(key)` helper. No
  i18n library until there is a second locale and pluralisation becomes real.
- **Transcription language:** `APP_LOCALE` is passed to the provider on every call and stored
  per note in `meta.json.language`, so notes keep their language even after the app setting
  changes.
- **Prompts (Stage 4):** `backend/prompts/<locale>/<mode>.md`.
- Adding a language = adding `<locale>.json` and `prompts/<locale>/`. Per-note language
  selection in the UI is a later feature, not an architectural change.

## 7. Security & privacy

- Audio leaves the machine for the STT vendor; the user is told this in the UI (one line).
- Vendor API keys come from environment / `.env` (gitignored); never reach the frontend.
- Mic permission is requested on first record press, not on page load.
- Upload limits enforced server-side (size, MIME allowlist).
- No auth in the MVP: the server binds to `127.0.0.1` only. Auth arrives with deployment.
- Raw audio is retained indefinitely by design (3.6); deleting a note deletes its folder.

## 8. Repository layout

```
audio-logger/
  ARCHITECTURE.md  ROADMAP.md  README.md
  backend/         pyproject.toml, uv.lock, src/audio_logger/, tests/, prompts/
  frontend/        package.json, vite.config.ts, src/
  notes/           gitignored user data
  .env.example
```

## 9. Deployment (Stage 6) – GCP is a viable target

Google Cloud is the leading candidate for deployment. Assessed 2026-10-09; not yet decided.

- **Compute:** Cloud Run, request-based billing, no minimum instance. A single-user app stays
  inside the free tier.
- **Audio storage:** Cloud Storage bucket replaces the `audio.webm` files in note folders.
- **STT option:** Speech-to-Text V2 `chirp_3` supports Finnish in the `eu` multi-region with
  automatic punctuation (no diarisation for Finnish). Batch price ~$0.18/h vs ElevenLabs
  ~$0.22/h; the saving is negligible at expected volume. The real differentiator is **EU data
  residency**. Google's synchronous endpoint has tight inline-audio limits, so recordings would go
  via Cloud Storage and the async batch endpoint – which fits the storage plan above. Implemented
  as a second `TranscriptionProvider` and compared against ElevenLabs on kept audio before
  switching (see ROADMAP parking lot).
- **LLM option:** Claude is available on Vertex AI at the same per-token price as Anthropic
  direct, so there is no cost gain; the gain is single billing/IAM and EU regions. Some newer
  Claude API features lag or are absent on Vertex; Stage 4 modes need only plain messages, so
  this is not blocking. Model and platform are chosen when Stage 4 starts.
- **Database:** avoid a managed Postgres instance (fixed monthly floor) until there is a reason
  for one; SQLite on a persistent volume or Firestore first.
- **Not a reason to change the MVP.** Every GCP service above slots into an existing seam
  (`TranscriptionProvider`, `NoteRepository`, Stage 4 `ProcessingService`).

## 10. Open questions

- Stage 4: which LLM (Claude vs Gemini Flash for clean-up) and whether to stream the processed text.
- Stage 5: SQLite, Firestore or Postgres.
- Stage 6: confirm GCP vs alternatives; auth mechanism.

## 11. Decision log

| Date | Decision | Alternatives considered | Rationale |
|------|----------|-------------------------|-----------|
| 2026-10-09 | Transcription via cloud STT API, batch after stop | Local Whisper, browser Web Speech API | Best Finnish accuracy per effort; Web Speech is Chrome-only and unreliable for Finnish; local Whisper deferred as a future provider |
| 2026-10-09 | Backend in Python / FastAPI | Node + TypeScript | Author's strongest language; keeps the door open for local ML |
| 2026-10-09 | Claude used for post-processing modes, not transcription | – | Anthropic has no STT endpoint |
| 2026-10-09 | Frontend in React + Vite + TS | Vanilla TS, plain HTML, Svelte | Avoid a framework migration at Stage 3; author preference |
| 2026-10-09 | Keep raw audio permanently | Discard, keep temporarily | Enables re-transcription and vendor comparison |
| 2026-10-09 | One folder per note (`note.md`, `audio.webm`, `meta.json`) | Flat .md with frontmatter | Keeps audio with its note; maps 1:1 to a future DB row |
| 2026-10-09 | STT vendor: ElevenLabs Scribe v2, single vendor, no bake-off | OpenAI gpt-transcribe, Deepgram Nova-3, bake-off | Finnish in vendor's top tier, cheapest, 3 GB limit; interface keeps swap cheap |
| 2026-10-09 | Chrome/Chromium only until deployment | Chrome + Safari, mobile | One audio format (WebM/Opus); Safari MediaRecorder quirks deferred |
| 2026-10-09 | `notes/` gitignored | Commit .md only, commit all | User data, not source; audio would bloat history |
| 2026-10-09 | Pause/resume via `MediaRecorder.pause()` | Segment + stitch on backend | One continuous file, no server-side audio work |
| 2026-10-09 | No Rust components planned | Rust preprocessing module via PyO3 | Every candidate job was eliminated by the above choices |
| 2026-10-09 | uv + ruff + pytest | Poetry, pip/venv | Single fast toolchain with lockfile |
| 2026-10-09 | `backend/` + `frontend/` layout | Frontend inside Python package, shared/ contracts dir | Clear ownership; shared contracts premature with one consumer |
| 2026-10-09 | i18n: single `APP_LOCALE`, per-locale resource files, language stored per note | Per-note selector, vendor auto-detect | Matches one user / one language today; adding a language is additive |
| 2026-10-09 | MVP control: button + Space toggle, Escape cancels | Button only, push-to-talk | Keyboard is cheap; push-to-talk conflicts with pause/resume |
| 2026-10-09 | Synchronous transcription in the request | Job queue + polling | Seconds of latency for minutes of audio; revisit if >30 s |
| 2026-10-09 | GCP marked as viable deployment target (not yet decided) | Fly.io, Vercel + separate backend, VPS | Cloud Run free tier covers a single user; Chirp 3 offers EU residency for Finnish audio; Claude available on Vertex at parity pricing |
| 2026-10-09 | Vendor HTTP via `httpx2` directly, not the `elevenlabs` SDK | Official SDK | One multipart POST; `httpx2` is what Starlette's `TestClient` already needs, so zero extra deps and `MockTransport` makes the provider testable offline |
| 2026-10-09 | STT failure -> 502 `transcription_failed` with `note_id` + `path`; audio, `meta.json` (`transcription: null`) and empty `note.md` already on disk | 200 with partial Note | Keeps "2xx = full Note" one shape; the frontend localises the code and shows the saved folder |
| 2026-10-09 | Backend errors carry a stable `code`, frontend localises via `t("error.<code>")`; no backend `i18n/` in Stage 1 | Localised messages from the backend | Backend has no user-facing strings until Stage 4 prompts |
| 2026-10-09 | Sync everywhere: `def` routes, sync HTTP client, sync repository | async routes + `AsyncClient` | Single user; FastAPI runs sync routes in a threadpool; tests stay plain |
| 2026-10-09 | App factory (`uvicorn audio_logger.main:create_app --factory`), no module-level `app` | Module-level `app` | `build_provider()` fails fast without an API key; a module-level app would make importing `main` (tests) fail on key-less machines |
| 2026-10-09 | `STT_PROVIDER=fake` setting reuses the test fake | Separate mock server | Exercise the full UI in Chrome without a key or spend, no new infrastructure |
| 2026-10-09 | Frontend package manager: pnpm; template toolchain kept (oxlint) | npm, yarn | Author preference; lint ships with the Vite template at no extra cost |
| 2026-10-09 | No frontend unit tests in Stage 1 | Vitest + jsdom | The logic is MediaRecorder / getUserMedia glue jsdom cannot run; `tsc` + manual Chrome checklist instead; revisit at Stage 3 |
| 2026-10-09 | Upload via `XMLHttpRequest` with `upload.onload` | `fetch` | `fetch` has no upload-complete signal for the `uploading -> transcribing` transition; XHR is ten lines, no dependency |
| 2026-10-09 | Relative `NOTES_DIR` / `FRONTEND_DIST` resolve against the repo root | Process working directory | Matches `.env.example`; independent of where uvicorn is launched |
| 2026-10-09 | Upload limit enforced by reading `MAX_UPLOAD_BYTES + 1` in the route | Request-body cap in the server | Caps memory and what is persisted; Starlette still spools an oversized body to a temp file before the 413, acceptable for a localhost single-user MVP |
