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

Click the button or press **Space** to start, again to stop; **Escape** cancels without saving.
The transcript appears in the page and the note lands in `notes/<id>/` as `note.md`,
`audio.webm` and `meta.json`. If transcription fails, the audio and metadata are still saved
and the UI shows the folder.

## Checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd frontend && pnpm build && pnpm lint
```

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
