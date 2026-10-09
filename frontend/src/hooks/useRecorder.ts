import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, createNote } from '../api'
import type { ErrorCode, RecorderState } from '../types'

const MIME_TYPE = 'audio/webm;codecs=opus'

function micErrorCode(err: unknown): ErrorCode {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'mic_denied'
  return 'mic_unavailable'
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
  // Mirror of state.status so the stable callbacks below can read the latest value.
  const statusRef = useRef(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)
  const startingRef = useRef(false)

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle' || startingRef.current) return
    if (
      typeof MediaRecorder === 'undefined' ||
      !MediaRecorder.isTypeSupported(MIME_TYPE) ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState({ status: 'error', code: 'recorder_unsupported' })
      return
    }

    startingRef.current = true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setState({ status: 'error', code: micErrorCode(err) })
      return
    } finally {
      startingRef.current = false
    }

    const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE })
    chunksRef.current = []
    cancelledRef.current = false

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      // Always release the mic so Chrome's recording indicator clears.
      stream.getTracks().forEach((track) => track.stop())
      recorderRef.current = null
      const chunks = chunksRef.current
      chunksRef.current = []

      if (cancelledRef.current) {
        setState({ status: 'idle' })
        return
      }

      // MediaRecorder's WebM carries no duration header, so measure it here.
      const durationMs = Math.round(performance.now() - startedAtRef.current)
      const blob = new Blob(chunks, { type: recorder.mimeType })
      setState({ status: 'uploading' })
      createNote(blob, recorder.mimeType, durationMs, () => setState({ status: 'transcribing' }))
        .then((note) => setState({ status: 'done', note }))
        .catch((err: unknown) => {
          if (err instanceof ApiError) {
            setState({ status: 'error', code: err.code, path: err.path })
          } else {
            setState({ status: 'error', code: 'unknown' })
          }
        })
    }

    recorder.start()
    recorderRef.current = recorder
    startedAtRef.current = performance.now()
    setState({ status: 'recording', startedAt: startedAtRef.current })
  }, [])

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
      setState({ status: 'idle' })
    }
  }, [])

  return { state, start, stop, cancel, toggle, reset }
}
