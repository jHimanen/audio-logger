import json
from itertools import count
from pathlib import Path

from audio_logger.models import Note
from audio_logger.storage.base import NoteNotFound

META_FILE = "meta.json"
NOTE_FILE = "note.md"


class FilesystemNoteRepository:
    """One folder per note under `root`: audio file, note.md and meta.json (written last)."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def save(self, note: Note, audio: bytes) -> str:
        self.root.mkdir(parents=True, exist_ok=True)
        folder, id = self._create_folder(note.id)
        (folder / note.audio.file).write_bytes(audio)
        (folder / NOTE_FILE).write_text(note.text, encoding="utf-8")
        meta = note.model_dump(mode="json", exclude={"text"}) | {"id": id}
        (folder / META_FILE).write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        return id

    def get(self, id: str) -> Note:
        folder = self.root / id
        if folder.parent != self.root or not (folder / META_FILE).is_file():
            raise NoteNotFound(id)
        meta = json.loads((folder / META_FILE).read_text(encoding="utf-8"))
        meta["text"] = (folder / NOTE_FILE).read_text(encoding="utf-8")
        return Note.model_validate(meta)

    def list(self) -> list[Note]:
        if not self.root.is_dir():
            return []
        ids = sorted(
            (p.name for p in self.root.iterdir() if (p / META_FILE).is_file()), reverse=True
        )
        return [self.get(id) for id in ids]

    def _create_folder(self, wanted: str) -> tuple[Path, str]:
        id = wanted
        for n in count(2):
            folder = self.root / id
            try:
                folder.mkdir()
                return folder, id
            except FileExistsError:
                id = f"{wanted}-{n}"
        raise AssertionError("unreachable")
