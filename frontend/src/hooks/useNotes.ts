import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchNotes } from '../api'
import type { ErrorCode, NoteResponse } from '../types'

export interface Notes {
  notes: NoteResponse[]
  error: ErrorCode | null
  reload: () => void
}

/** Saved notes, newest first. Loads on mount; call reload() after saving one. */
export function useNotes(): Notes {
  const [notes, setNotes] = useState<NoteResponse[]>([])
  const [error, setError] = useState<ErrorCode | null>(null)

  const reload = useCallback(() => {
    fetchNotes()
      .then((loaded) => {
        setNotes(loaded)
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.code : 'unknown'))
  }, [])

  useEffect(reload, [reload])

  return { notes, error, reload }
}
