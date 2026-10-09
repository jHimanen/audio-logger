# Roadmap

> Living document. Stages are ordered; each stage is shippable on its own.
> Last updated: 2026-10-09 (Stage 2 implemented)

## Stage 0 – Planning 

- [x] Repo created
- [x] Tech stack chosen and justified (see ARCHITECTURE.md §10)
- [x] ARCHITECTURE.md reviewed and accepted
- [x] ROADMAP.md reviewed and accepted

## Stage 1 – MVP: record, transcribe, save

Goal: press a button (or Space), speak, press again to stop; the Finnish transcript appears
in the UI and is saved as `notes/<id>/note.md` with its audio and metadata.

Backend
- [x] `uv init` backend, FastAPI app, `pydantic-settings` config (`APP_LOCALE`, `NOTES_DIR`, `ELEVENLABS_API_KEY`)
- [x] `TranscriptionProvider` protocol + `FakeTranscriptionProvider`
- [x] `ElevenLabsProvider` (Scribe v2, `language_code=fi`)
- [x] `NoteRepository` protocol + filesystem implementation (folder per note, `meta.json` schema from §5)
- [x] `POST /api/notes` (multipart audio -> Note JSON), `GET /api/config`
- [x] Size/MIME validation, error responses, audio saved even when STT fails
- [x] Tests: service flow with fake provider and tmp dir; repository round-trip
- [x] Serve `frontend/dist` as static files

Frontend
- [x] Vite + React + TS scaffold, `/api` proxy
- [x] `useRecorder` hook around `MediaRecorder` (idle / recording / uploading / transcribing / done / error)
- [x] Record button + Space toggle + Escape cancel, recording timer
- [x] Transcript view (read-only) with saved path
- [x] `locales/fi.json` and `t()` helper; all visible strings go through it
- [x] Error states: mic denied, upload failed, STT failed

Repo
- [x] `.gitignore` (`notes/`, `.env`, `node_modules/`, `.venv/`, `dist/`)
- [x] `.env.example`, README with run instructions

Out of scope: pause/resume, editing, auth, DB, deployment, Safari.

## Stage 2 – Recording ergonomics

- [x] Pause / resume within one recording (`MediaRecorder.pause()` / `resume()`)
- [x] Keyboard: pause key, visible shortcut hints
- [x] Level meter (Web Audio `AnalyserNode`) so the user sees the mic is live
- [x] Note list in the UI (`GET /api/notes`), open an existing note, replay its audio

## Stage 3 – Editing (current)

- [ ] Editable transcript before and after saving (`PUT /api/notes/{id}`)
- [ ] `raw_text` stays immutable in `meta.json`; `note.md` holds the edited text; `edited_at` set
- [ ] Unsaved-changes guard
- [ ] Delete note (removes the folder)

## Stage 4 – Post-processing modes (Claude)

- [ ] Mode framework: `backend/prompts/<locale>/<mode>.md` + manifest; `ProcessingService`
- [ ] First modes for `fi`: `cleanup` (fillers, punctuation, paragraphs), `summary`, `bullets`
- [ ] Mode selector in the UI; result replaces `note.md`, raw transcript preserved
- [ ] Decide model and streaming; record in ARCHITECTURE.md
- [ ] Optional: auto-apply a default mode on save

## Stage 5 – Persistence

- [ ] `NoteRepository` implementation on a database (SQLite first unless deployment target says otherwise)
- [ ] Audio moved to blob storage; migration script from `notes/` folders
- [ ] Search across notes

## Stage 6 – Deployment & multi-language

Leading candidate: **GCP** (Cloud Run + Cloud Storage; see ARCHITECTURE.md §9).

- [ ] Confirm hosting target; HTTPS, secrets management (Secret Manager if GCP)
- [ ] Containerise backend (serves `frontend/dist`), deploy to Cloud Run
- [ ] `NoteRepository` audio backend on Cloud Storage
- [ ] Auth (single-user login at minimum)
- [ ] Safari / mobile browser support (MP4/AAC input)
- [ ] Second locale (`en`): `locales/en.json`, `prompts/en/`, per-note language selector

## Parking lot

- STT bake-off: second `TranscriptionProvider` run over stored audio, compared against
  ElevenLabs. Candidates: Google Chirp 3 (`eu` region, EU residency; natural fit if deploying
  to GCP) or OpenAI `gpt-transcribe`. Trigger: accuracy disappoints, or GCP deployment begins.
- Local STT provider (`whisper-rs` via PyO3) for offline/private use.
- Streaming transcription for live text while speaking.
- Speaker diarisation (Scribe v2 supports it) for meeting-style notes.
- WebM duration/cues header so the player shows a length and can seek (MediaRecorder omits
  it; fix by rewriting the header on save or in the browser).
- `FilesystemNoteRepository.list()` fails the whole list on one corrupt `meta.json`; skip and
  log bad entries instead.
