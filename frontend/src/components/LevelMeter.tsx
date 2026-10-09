import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream
  paused: boolean
}

/**
 * Live mic level. Owns its AudioContext and animation loop and writes the bar's transform
 * directly, so it does not re-render per frame. The mic stays open while paused, so the bar
 * keeps moving; it is dimmed instead.
 */
export function LevelMeter({ stream, paused }: Props) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = new AudioContext()
    ctx.resume().catch(() => {})
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    // A longer window gives a steadier RMS than the default.
    analyser.fftSize = 2048
    source.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    let frame = 0
    const draw = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const v of samples) {
        const x = (v - 128) / 128
        sum += x * x
      }
      // Speech RMS rarely exceeds ~0.3; scale so normal speech fills most of the bar.
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 4)
      if (barRef.current) barRef.current.style.transform = `scaleX(${level})`
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      ctx.close().catch(() => {})
    }
  }, [stream])

  return (
    <div className={paused ? 'level-meter paused' : 'level-meter'} aria-hidden="true">
      <div ref={barRef} className="level-meter-bar" />
    </div>
  )
}
