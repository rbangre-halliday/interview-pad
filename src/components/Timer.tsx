import { useState, useEffect, useRef } from 'react'
import './Timer.css'

interface TimerProps {
  duration: number
  started_at: number | null
  elapsed_before_pause: number
  is_interviewer: boolean
  on_start: () => void
  on_pause: () => void
  on_reset: () => void
  on_set_duration: (ms: number) => void
}

const PRESETS = [
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '30m', ms: 30 * 60 * 1000 },
  { label: '45m', ms: 45 * 60 * 1000 },
  { label: '60m', ms: 60 * 60 * 1000 },
]

function format_time(ms: number): string {
  const total_seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total_seconds / 60)
  const seconds = total_seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function Timer({
  duration,
  started_at,
  elapsed_before_pause,
  is_interviewer,
  on_start,
  on_pause,
  on_reset,
  on_set_duration,
}: TimerProps) {
  const [now, set_now] = useState(Date.now())
  const [show_presets, set_show_presets] = useState(false)
  const interval_ref = useRef<number | null>(null)
  const presets_ref = useRef<HTMLDivElement>(null)

  const is_running = started_at !== null && started_at > 0

  useEffect(() => {
    if (is_running) {
      set_now(Date.now())
      interval_ref.current = window.setInterval(() => set_now(Date.now()), 250)
    } else {
      if (interval_ref.current) clearInterval(interval_ref.current)
    }
    return () => {
      if (interval_ref.current) clearInterval(interval_ref.current)
    }
  }, [is_running])

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!show_presets) return
    const handle_click = (e: MouseEvent) => {
      if (presets_ref.current && !presets_ref.current.contains(e.target as Node)) {
        set_show_presets(false)
      }
    }
    document.addEventListener('mousedown', handle_click)
    return () => document.removeEventListener('mousedown', handle_click)
  }, [show_presets])

  const elapsed = is_running
    ? (now - started_at!) + elapsed_before_pause
    : elapsed_before_pause

  const remaining = Math.max(0, duration - elapsed)
  const is_low = remaining < 2 * 60 * 1000 && remaining > 0
  const is_done = remaining === 0 && elapsed > 0

  const status_class = is_done ? 'timer-done' : is_low ? 'timer-low' : ''

  return (
    <div className={`timer ${status_class}`}>
      <span className="timer-display">{format_time(remaining)}</span>
      {is_interviewer && (
        <div className="timer-controls">
          <button
            className="timer-btn"
            onClick={is_running ? on_pause : on_start}
            title={is_running ? 'Pause' : 'Start'}
          >
            {is_running ? '⏸' : '▶'}
          </button>
          <button className="timer-btn" onClick={on_reset} title="Reset">
            ↺
          </button>
          <div className="timer-preset-wrapper" ref={presets_ref}>
            <button
              className="timer-btn timer-duration-btn"
              onClick={() => set_show_presets(!show_presets)}
              title="Set duration"
            >
              {Math.round(duration / 60000)}m
            </button>
            {show_presets && (
              <div className="timer-presets">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    className={`timer-preset ${duration === p.ms ? 'active' : ''}`}
                    onClick={() => { on_set_duration(p.ms); set_show_presets(false) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
