# Roadmap

> Living document. Stages are ordered; each stage is shippable on its own.
> Last updated: 2026-11-08 (Stages 5–6 replaced by the move into `mokki-web`; see `../roadmap.md` Phase 5)

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

## Stage 3 – Editing

- [x] Editable transcript before and after saving (`PUT /api/notes/{id}`)
- [x] `raw_text` stays immutable in `meta.json`; `note.md` holds the edited text; `edited_at` set
- [x] Unsaved-changes guard
- [x] Delete note (removes the folder)
- [x] Extra: restore the original transcript into the editor
- [x] Extra: frontend unit tests (Vitest + jsdom + Testing Library)

## Stage 4 – Post-processing modes (Claude) (next, last stage in this repo)

Independent of the family site; can start now. Build it here so it moves to `mokki-web`
finished and tested.

- [ ] Mode framework: `backend/prompts/<locale>/<mode>.md` + manifest; `ProcessingService`
- [ ] First modes for `fi`: `cleanup` (fillers, punctuation, paragraphs), `summary`, `bullets`
- [ ] `dictation` mode for `fi`: reading paper logbooks aloud. Verbatim wording (no
      rephrasing or modernising), spoken punctuation commands, dates and numbers as digits,
      reader asides as `[epäselvä]`-style markers, a date heading per entry
- [ ] Mode selector in the UI; result replaces `note.md`, raw transcript preserved
- [ ] Claude called from the backend only (no keys in the browser); decide model and
      streaming, record in ARCHITECTURE.md
- [ ] Optional: auto-apply a default mode on save

## After Stage 4 – folded into `mokki-web`

The audio logger becomes part of the Kaartama family site. Its backend and frontend move into
`mokki-web`, with their history, and this repo is archived. That work is **Phase 5 of the
high-level roadmap (`../roadmap.md`)**, which owns the plan from here on: one backend, one
deployment, one login, notes in the shared archive bucket, a recording view inside the site,
and "Lisää lokiin" writing to the vault's logbook.

The previous Stage 5 (SQLite, blob storage, search) and Stage 6 (standalone GCP deployment,
own auth, second locale) are replaced by that phase and will not be built here.

Before Stage 4 is done, keep this repo self-contained: do not add code for the bucket, Access,
or `mokki-web` here. Those land in `mokki-web` as part of the move.

## Parking lot

Moves to `mokki-web` with the code. Not planned unless a trigger below fires.

- STT bake-off: second `TranscriptionProvider` run over stored audio, compared against
  ElevenLabs. Candidates: Google Chirp 3 (`eu` region, EU residency) or OpenAI
  `gpt-transcribe`. Trigger: accuracy disappoints or EU residency becomes a requirement.
- Search across notes. Not planned: the family site's search covers logbook entries, and
  those are what matter.
- Second locale (`en`): `locales/en.json`, `prompts/en/`, per-note language selector. Not
  planned while the family is the only audience.
- Local STT provider (`whisper-rs` via PyO3) for offline/private use.
- Streaming transcription for live text while speaking.
- Speaker diarisation (Scribe v2 supports it) for meeting-style notes.
- WebM duration/cues header so the player shows a length and can seek (MediaRecorder omits
  it; fix by rewriting the header on save or in the browser).
- `FilesystemNoteRepository.list()` fails the whole list on one corrupt `meta.json`; skip and
  log bad entries instead. Same fix: a symlinked folder inside `notes/` makes `DELETE` return
  500 (`rmtree` refuses symlinks); reject symlinks in `_folder()` together with this.
- Cmd/Ctrl+S to save from the editor.
