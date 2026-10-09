import { useCallback, useRef, useState } from 'react'
import { ApiError, createNote } from '../api'
import type { ErrorCode, RecorderState } from '../types'

const MIME_TYPE = 'audio/webm;codecs=opus'

function micErrorCode(err: unknown): ErrorCode {
  return err instanceof DOMException && err.name === 'NotAllowedError'
    ? 'mic_denied'
    : 'mic_unavailable'
}

export interface Recorder {
  state: RecorderState
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  toggle: () => void
  reset: () => void
}

export function useRecorder(): Recorder {
  const [state, setState] = useState<RecorderState>({ status: 'idle' })
  // Mirror of state.status, written synchronously so the stable callbacks below never
  // read a stale value between a transition and the next render.
  const statusRef = useRef<RecorderState['status']>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const cancelledRef = useRef(false)
  const startingRef = useRef(false)

  const transition = useCallback((next: RecorderState) => {
    statusRef.current = next.status
    setState(next)
  }, [])

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle' || startingRef.current) return
    if (
      typeof MediaRecorder === 'undefined' ||
      !MediaRecorder.isTypeSupported(MIME_TYPE) ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      transition({ status: 'error', code: 'recorder_unsupported' })
      return
    }

    startingRef.current = true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      transition({ status: 'error', code: micErrorCode(err) })
      return
    } finally {
      startingRef.current = false
    }

    const chunks: Blob[] = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE })
      recorder.start()
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      transition({ status: 'error', code: 'recorder_unsupported' })
      return
    }
    const startedAt = performance.now()
    cancelledRef.current = false
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      // Always release the mic so Chrome's recording indicator clears.
      stream.getTracks().forEach((track) => track.stop())
      recorderRef.current = null

      if (cancelledRef.current) {
        transition({ status: 'idle' })
        return
      }

      // MediaRecorder's WebM carries no duration header, so measure it here.
      const durationMs = Math.round(performance.now() - startedAt)
      const blob = new Blob(chunks, { type: recorder.mimeType })
      transition({ status: 'uploading' })
      createNote(blob, recorder.mimeType, durationMs, () => transition({ status: 'transcribing' }))
        .then((note) => transition({ status: 'done', note }))
        .catch((err: unknown) => {
          if (err instanceof ApiError) {
            transition({ status: 'error', code: err.code, path: err.path })
          } else {
            transition({ status: 'error', code: 'unknown' })
          }
        })
    }

    transition({ status: 'recording', startedAt })
  }, [transition])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== 'recording' || !recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== 'recording' || !recorder || recorder.state === 'inactive') return
    cancelledRef.current = true
    recorder.stop()
  }, [])

  const toggle = useCallback(() => {
    if (statusRef.current === 'idle') void start()
    else if (statusRef.current === 'recording') stop()
  }, [start, stop])

  const reset = useCallback(() => {
    if (statusRef.current === 'done' || statusRef.current === 'error') {
      transition({ status: 'idle' })
    }
  }, [transition])

  return { state, start, stop, cancel, toggle, reset }
}
