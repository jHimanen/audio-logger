import { useCallback, useRef, useState } from 'react'
import { ApiError, createNote } from '../api'
import type { ErrorCode, RecorderState } from '../types'

const MIME_TYPE = 'audio/webm;codecs=opus'

function micErrorCode(err: unknown): ErrorCode {
  return err instanceof DOMException && err.name === 'NotAllowedError'
    ? 'mic_denied'
    : 'mic_unavailable'
}

function isActive(status: RecorderState['status']): boolean {
  return status === 'recording' || status === 'paused'
}

export interface Recorder {
  state: RecorderState
  /** The live mic stream while recording or paused, else null. */
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  pause: () => void
  resume: () => void
  togglePause: () => void
  toggle: () => void
  reset: () => void
}

export function useRecorder(): Recorder {
  const [state, setState] = useState<RecorderState>({ status: 'idle' })
  const [stream, setStream] = useState<MediaStream | null>(null)
  // Mirror of state.status, written synchronously so the stable callbacks below never
  // read a stale value between a transition and the next render.
  const statusRef = useRef<RecorderState['status']>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const cancelledRef = useRef(false)
  const startingRef = useRef(false)
  // Virtual start (now minus active time) while recording; active time while paused.
  const startedAtRef = useRef(0)
  const pausedElapsedRef = useRef<number | null>(null)

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
    startedAtRef.current = performance.now()
    pausedElapsedRef.current = null
    cancelledRef.current = false
    recorderRef.current = recorder
    setStream(stream)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      // Always release the mic so Chrome's recording indicator clears.
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      recorderRef.current = null

      if (cancelledRef.current) {
        transition({ status: 'idle' })
        return
      }

      // MediaRecorder's WebM carries no duration header, so measure it here. Paused time is
      // excluded: the recorder captures nothing while paused.
      const durationMs = Math.round(
        pausedElapsedRef.current ?? performance.now() - startedAtRef.current,
      )
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

    transition({ status: 'recording', startedAt: startedAtRef.current })
  }, [transition])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!isActive(statusRef.current) || !recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (!isActive(statusRef.current) || !recorder || recorder.state === 'inactive') return
    cancelledRef.current = true
    recorder.stop()
  }, [])

  const pause = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== 'recording' || recorder?.state !== 'recording') return
    const elapsedMs = performance.now() - startedAtRef.current
    recorder.pause()
    pausedElapsedRef.current = elapsedMs
    transition({ status: 'paused', elapsedMs })
  }, [transition])

  const resume = useCallback(() => {
    const recorder = recorderRef.current
    const elapsedMs = pausedElapsedRef.current
    if (statusRef.current !== 'paused' || recorder?.state !== 'paused' || elapsedMs === null) return
    recorder.resume()
    startedAtRef.current = performance.now() - elapsedMs
    pausedElapsedRef.current = null
    transition({ status: 'recording', startedAt: startedAtRef.current })
  }, [transition])

  const togglePause = useCallback(() => {
    if (statusRef.current === 'recording') pause()
    else if (statusRef.current === 'paused') resume()
  }, [pause, resume])

  const toggle = useCallback(() => {
    if (statusRef.current === 'idle') void start()
    else if (isActive(statusRef.current)) stop()
  }, [start, stop])

  const reset = useCallback(() => {
    if (statusRef.current === 'done' || statusRef.current === 'error') {
      transition({ status: 'idle' })
    }
  }, [transition])

  return { state, stream, start, stop, cancel, pause, resume, togglePause, toggle, reset }
}
