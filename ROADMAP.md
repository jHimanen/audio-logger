# Roadmap

> Living document. Stages are ordered; each stage is shippable on its own.
> Last updated: 2026-10-09

## Stage 0 – Planning (current)

- [x] Repo created
- [x] Tech stack chosen and justified (see ARCHITECTURE.md §10)
- [ ] ARCHITECTURE.md reviewed and accepted
- [ ] ROADMAP.md reviewed and accepted

## Stage 1 – MVP: record, transcribe, save

Goal: press a button (or Space), speak, press again to stop; the Finnish transcript appears
in the UI and is saved as `notes/<id>/note.md` with its audio and metadata.

Backend
- [ ] `uv init` backend, FastAPI app, `pydantic-settings` config (`APP_LOCALE`, `NOTES_DIR`, `ELEVENLABS_API_KEY`)
- [ ] `TranscriptionProvider` protocol + `FakeTranscriptionProvider`
- [ ] `ElevenLabsProvider` (Scribe v2, `language_code=fi`)
- [ ] `NoteRepository` protocol + filesystem implementation (folder per note, `meta.json` schema from §5)
- [ ] `POST /api/notes` (multipart audio -> Note JSON), `GET /api/config`
- [ ] Size/MIME validation, error responses, audio saved even when STT fails
- [ ] Tests: service flow with fake provider and tmp dir; repository round-trip
- [ ] Serve `frontend/dist` as static files

Frontend
- [ ] Vite + React + TS scaffold, `/api` proxy
- [ ] `useRecorder` hook around `MediaRecorder` (idle / recording / uploading / transcribing / done / error)
- [ ] Record button + Space toggle + Escape cancel, recording timer
- [ ] Transcript view (read-only) with saved path
- [ ] `locales/fi.json` and `t()` helper; all visible strings go through it
- [ ] Error states: mic denied, upload failed, STT failed

Repo
- [ ] `.gitignore` (`notes/`, `.env`, `node_modules/`, `.venv/`, `dist/`)
- [ ] `.env.example`, README with run instructions

Out of scope: pause/resume, editing, auth, DB, deployment, Safari.

## Stage 2 – Recording ergonomics

- [ ] Pause / resume within one recording (`MediaRecorder.pause()` / `resume()`)
- [ ] Keyboard: pause key, visible shortcut hints
- [ ] Level meter (Web Audio `AnalyserNode`) so the user sees the mic is live
- [ ] Note list in the UI (`GET /api/notes`), open an existing note, replay its audio

## Stage 3 – Editing

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

- [ ] Hosting target, HTTPS, secrets management
- [ ] Auth (single-user login at minimum)
- [ ] Safari / mobile browser support (MP4/AAC input)
- [ ] Second locale (`en`): `locales/en.json`, `prompts/en/`, per-note language selector

## Parking lot

- STT bake-off: second `TranscriptionProvider` (OpenAI `gpt-transcribe`) run over stored audio,
  compared against ElevenLabs. Only if accuracy disappoints.
- Local STT provider (`whisper-rs` via PyO3) for offline/private use.
- Streaming transcription for live text while speaking.
- Speaker diarisation (Scribe v2 supports it) for meeting-style notes.
