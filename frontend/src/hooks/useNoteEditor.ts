import { useEffect, useRef, useState } from 'react'
import { ApiError, deleteNote, updateNote } from '../api'
import type { ErrorCode, NoteResponse } from '../types'

export interface NoteEditor {
  text: string
  setText: (text: string) => void
  dirty: boolean
  saving: boolean
  error: ErrorCode | null
  editedAt: string | null
  save: () => Promise<void>
  /** Loads the original transcript into the draft; the user still saves it explicitly. */
  restore: () => void
  canRestore: boolean
  /** Deletes the note and its audio; a note that is already gone counts as deleted. */
  remove: () => Promise<void>
}

/**
 * Draft state for the viewed note. A new `note` object drops the draft, so pass the same
 * object while the same note stays on screen. After a save the editor shows the server's
 * copy itself; `onSaved` receives it too. `onDeleted` should stop showing that note.
 */
export function useNoteEditor(
  note: NoteResponse | null,
  onSaved: (note: NoteResponse) => void,
  onDeleted: (id: string) => void,
): NoteEditor {
  const [shown, setShown] = useState(note)
  // The note as last saved from this editor; `note` itself may be stale after a save.
  const [saved, setSaved] = useState<NoteResponse | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  if (note !== shown) {
    setShown(note)
    setSaved(null)
    setDraft(null)
    setSaving(false)
    setError(null)
  }

  // A save can resolve after the user has moved to another note.
  const latestId = useRef(note?.id)
  useEffect(() => {
    latestId.current = note?.id
  })

  const current = saved ?? note
  const text = draft ?? current?.text ?? ''
  const dirty = current !== null && draft !== null && draft !== current.text
  const raw = current?.transcription?.raw_text
  const canRestore = raw !== undefined && text !== raw

  const fail = (id: string, err: unknown) => {
    if (latestId.current === id) setError(err instanceof ApiError ? err.code : 'unknown')
  }

  const save = async () => {
    if (!current || draft === null || !dirty || saving) return
    const sent = draft
    setSaving(true)
    setError(null)
    try {
      const updated = await updateNote(current.id, sent)
      if (latestId.current === updated.id) {
        setSaved(updated)
        // Keep anything typed while the request was in flight.
        setDraft((d) => (d === sent ? null : d))
      }
      onSaved(updated)
    } catch (err) {
      fail(current.id, err)
    } finally {
      if (latestId.current === current.id) setSaving(false)
    }
  }

  const remove = async () => {
    if (!current) return
    setError(null)
    try {
      await deleteNote(current.id)
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'not_found')) return fail(current.id, err)
    }
    onDeleted(current.id)
  }

  return {
    text,
    setText: setDraft,
    dirty,
    saving,
    error,
    editedAt: current?.edited_at ?? null,
    save,
    restore: () => {
      if (raw !== undefined) setDraft(raw)
    },
    canRestore,
    remove,
  }
}
