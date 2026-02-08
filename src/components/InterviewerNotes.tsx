import { useState, useEffect, useRef, useCallback } from 'react'
import './InterviewerNotes.css'

interface InterviewerNotesProps {
  room_id: string
}

const STORAGE_KEY_PREFIX = 'interview-notes-'

export default function InterviewerNotes({ room_id }: InterviewerNotesProps) {
  const [collapsed, set_collapsed] = useState(false)
  const [notes, set_notes] = useState('')
  const save_timeout = useRef<number | null>(null)

  // Load notes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${room_id}`)
    if (saved) set_notes(saved)
  }, [room_id])

  // Debounced save to localStorage
  const save_notes = useCallback((value: string) => {
    if (save_timeout.current) clearTimeout(save_timeout.current)
    save_timeout.current = window.setTimeout(() => {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${room_id}`, value)
    }, 300)
  }, [room_id])

  const handle_change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    set_notes(value)
    save_notes(value)
  }

  return (
    <div className={`interviewer-notes ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="notes-header"
        onClick={() => set_collapsed(!collapsed)}
      >
        <div className="notes-header-left">
          <span className="notes-lock">{'\u25C6'}</span>
          <span className="notes-title">PRIVATE NOTES</span>
        </div>
        <div className="notes-header-right">
          <span className="notes-badge">Only you</span>
          <span className="notes-chevron">{collapsed ? '\u25B4' : '\u25BE'}</span>
        </div>
      </button>
      {!collapsed && (
        <div className="notes-body">
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={handle_change}
            placeholder="Jot down observations, scores, follow-up questions..."
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}
