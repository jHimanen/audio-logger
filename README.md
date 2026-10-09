# audio-logger

Record Finnish speech in the browser, transcribe it with ElevenLabs Scribe v2, save it as
Markdown with the audio and metadata alongside. Backend: Python / FastAPI. Frontend: React /
Vite / TypeScript.

See `ARCHITECTURE.md` for design and `ROADMAP.md` for stages.

## Setup

Requirements: `uv`, Node 22+, `pnpm`, Chrome.

```bash
cp .env.example .env   # set ELEVENLABS_API_KEY, or STT_PROVIDER=fake to run without a key
```

## Run

Run instructions are added as Stage 1 lands.
