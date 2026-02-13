import { useState, useEffect, useRef } from 'react'
import './EndInterviewModal.css'

interface EndInterviewModalProps {
  room_id: string
  notes: string
  code: string
  language: string
  candidate_name: string
  on_close: () => void
}

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || '127.0.0.1:1999'

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export default function EndInterviewModal({
  room_id,
  notes,
  code,
  language,
  candidate_name,
  on_close,
}: EndInterviewModalProps) {
  const [email, set_email] = useState('')
  const [send_state, set_send_state] = useState<SendState>('idle')
  const [error_msg, set_error_msg] = useState('')
  const input_ref = useRef<HTMLInputElement>(null)
  const backdrop_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => input_ref.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handle_key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && send_state !== 'sending') on_close()
    }
    document.addEventListener('keydown', handle_key)
    return () => document.removeEventListener('keydown', handle_key)
  }, [on_close, send_state])

  const handle_backdrop_click = (e: React.MouseEvent) => {
    if (e.target === backdrop_ref.current && send_state !== 'sending') on_close()
  }

  const handle_send = async () => {
    if (!email.trim() || !email.includes('@')) {
      set_error_msg('Enter a valid email address')
      return
    }

    set_send_state('sending')
    set_error_msg('')

    const is_local = PARTYKIT_HOST.includes('localhost') || PARTYKIT_HOST.includes('127.0.0.1')
    const protocol = is_local ? 'http' : 'https'
    const path = is_local ? 'party' : 'parties/main'

    try {
      const res = await fetch(`${protocol}://${PARTYKIT_HOST}/${path}/${room_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), room_id, notes, code, language, candidate_name }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        set_send_state('error')
        set_error_msg(data.error || 'Failed to send')
        return
      }

      set_send_state('sent')
    } catch {
      set_send_state('error')
      set_error_msg('Network error — check your connection')
    }
  }

  const handle_key_down = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (send_state === 'idle' || send_state === 'error')) handle_send()
  }

  const note_lines = notes ? notes.split('\n').filter(l => l.trim()).length : 0
  const code_lines = code ? code.split('\n').filter(l => l.trim()).length : 0

  return (
    <div className="eim-backdrop" ref={backdrop_ref} onClick={handle_backdrop_click}>
      <div className="eim-modal" data-state={send_state}>
        <div className="eim-glow" />

        {send_state === 'sent' ? (
          <div className="eim-sent">
            <div className="eim-sent-ring">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14.5L11.5 20L22 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="eim-sent-text">
              <h2>Recap delivered</h2>
              <p>Sent to <strong>{email}</strong></p>
            </div>
            <button className="eim-btn eim-btn-done" onClick={on_close}>Close</button>
          </div>
        ) : (
          <>
            <div className="eim-head">
              <div className="eim-head-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <h2 className="eim-title">End Interview</h2>
                <p className="eim-desc">
                  {candidate_name
                    ? <>Wrap up your session with <strong>{candidate_name}</strong> and email yourself a recap.</>
                    : 'Wrap up your session and email yourself a recap.'
                  }
                </p>
              </div>
            </div>

            <div className="eim-summary">
              <div className="eim-summary-item">
                <div className="eim-summary-dot eim-dot-notes" />
                <span className="eim-summary-label">Notes</span>
                <span className="eim-summary-count">{note_lines ? `${note_lines} lines` : 'none'}</span>
              </div>
              <div className="eim-summary-item">
                <div className="eim-summary-dot eim-dot-code" />
                <span className="eim-summary-label">Solution</span>
                <span className="eim-summary-count">{code_lines ? `${code_lines} lines · ${language}` : 'none'}</span>
              </div>
            </div>

            <div className="eim-field">
              <label className="eim-label" htmlFor="eim-email">Send recap to</label>
              <input
                ref={input_ref}
                id="eim-email"
                type="email"
                className="eim-input"
                value={email}
                onChange={e => { set_email(e.target.value); set_error_msg('') }}
                onKeyDown={handle_key_down}
                placeholder="you@company.com"
                disabled={send_state === 'sending'}
                autoComplete="email"
              />
              {error_msg && <span className="eim-error">{error_msg}</span>}
            </div>

            <div className="eim-actions">
              <button
                className="eim-btn eim-btn-cancel"
                onClick={on_close}
                disabled={send_state === 'sending'}
              >
                Cancel
              </button>
              <button
                className="eim-btn eim-btn-send"
                onClick={handle_send}
                disabled={send_state === 'sending'}
              >
                {send_state === 'sending' ? (
                  <span className="eim-spinner" />
                ) : (
                  'Send & End'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
