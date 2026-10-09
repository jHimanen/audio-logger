# audio-logger

Record Finnish speech in the browser, transcribe it with ElevenLabs Scribe v2, save it as
Markdown with the audio and metadata alongside. Backend: Python / FastAPI. Frontend: React /
Vite / TypeScript. Chrome only for now.

See `ARCHITECTURE.md` for design and `ROADMAP.md` for stages.

## Setup

Requirements: `uv`, Node 22+, `pnpm`, Chrome.

```bash
cp .env.example .env        # set ELEVENLABS_API_KEY, or STT_PROVIDER=fake to run without a key
cd backend && uv sync
cd ../frontend && pnpm install
```

## Run (development)

Two terminals, from the repo root:

```bash
cd backend && uv run uvicorn audio_logger.main:create_app --factory \
    --host 127.0.0.1 --port 8000 --reload --reload-dir src
cd frontend && pnpm dev     # http://localhost:5173, proxies /api to the backend
```

`--reload-dir src` keeps writes to `notes/` from restarting the server mid-request.

## Run (production-style)

```bash
cd frontend && pnpm build   # writes frontend/dist
cd backend && uv run uvicorn audio_logger.main:create_app --factory --host 127.0.0.1 --port 8000
```

FastAPI serves `frontend/dist` at http://127.0.0.1:8000 when the folder exists.

## Use

Click the button or press **Space** to start, again to stop; **P** pauses and resumes;
**Escape** cancels without saving. The bar next to the button shows the mic level.
The transcript appears in the page and the note lands in `notes/<id>/` as `note.md`,
`audio.webm` and `meta.json`. If transcription fails, the audio and metadata are still saved
and the UI shows the folder.

Saved notes are listed below the recorder, newest first. Click one to read its transcript and
replay the audio (seeking does not work yet: MediaRecorder's WebM has no duration header).

## Checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd frontend && pnpm build && pnpm lint
```

Manual Chrome checklist (no frontend unit tests; run with `STT_PROVIDER=fake`):

1. Space starts; P pauses (timer freezes, status "Tauko.", button "Jatka"); P resumes from the
   frozen value; Space stops. The saved duration matches the player: pauses add no silence.
2. Click "Tauko" with the mouse, then Space: the recording stops, as the hint says.
3. Escape while paused cancels; the mic indicator clears and nothing is saved.
4. Cmd+P still opens print; P does nothing while idle.
5. The level bar moves while recording, dims while paused, and is gone after stop.
6. After saving, the new note heads the list; a failed transcription also appears, marked.
7. Open an old note: transcript and player appear. Space with the player focused plays audio;
   Space elsewhere starts a new recording and closes the note. The list is disabled meanwhile.

## API

- `GET /api/config` -> `{"locale": "fi"}`
- `POST /api/notes` multipart `audio` (file), `mime_type`, `duration_ms` -> `201` note JSON plus
  `path`. Errors are `{"error": {"code": "...", "message": "...", ...}}` with codes
  `invalid_mime` (415), `too_large` (413), `empty_audio` (400), `validation_error` (422),
  `transcription_failed` (502, audio kept; body carries `note_id` and `path`).
- `GET /api/notes` -> all notes, newest first, each in the same shape as the `POST` response.
- `GET /api/notes/{id}` -> one note, same shape.
- `GET /api/notes/{id}/audio` -> the recording with its stored mime type; supports `Range`.
- Unknown ids return `not_found` (404).
