import { useState } from 'react'
import * as Y from 'yjs'
import { Language } from '../lib/languages'
import './SessionControls.css'

interface SessionControlsProps {
  ytext: Y.Text | null
  language: Language
  room_id: string
}

export default function SessionControls({ ytext, language, room_id }: SessionControlsProps) {
  const [is_open, set_is_open] = useState(false)
  const [email, set_email] = useState('')
  const [is_sending, set_is_sending] = useState(false)
  const [status, set_status] = useState<'idle' | 'success' | 'error'>('idle')

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ytext || !email) return

    set_is_sending(true)
    set_status('idle')

    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          code: ytext.toString(),
          language: language.name,
          room_id,
        }),
      })

      if (!response.ok) throw new Error('Failed to send')
      set_status('success')
      setTimeout(() => {
        set_is_open(false)
        set_status('idle')
        set_email('')
      }, 2000)
    } catch {
      set_status('error')
    } finally {
      set_is_sending(false)
    }
  }

  return (
    <>
      <button
        className="end-session-button"
        onClick={() => set_is_open(true)}
      >
        End Session
      </button>

      {is_open && (
        <div className="modal-overlay" onClick={() => set_is_open(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>End Interview Session</h3>
            <p>Send the code to the interviewer via email.</p>
            <form onSubmit={handle_submit}>
              <input
                type="email"
                placeholder="interviewer@company.com"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                required
              />
              <div className="modal-buttons">
                <button
                  type="button"
                  className="modal-button secondary"
                  onClick={() => set_is_open(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-button primary"
                  disabled={is_sending}
                >
                  {is_sending ? 'Sending...' : 'Send & End'}
                </button>
              </div>
              {status === 'success' && (
                <div className="status-message success">Email sent successfully!</div>
              )}
              {status === 'error' && (
                <div className="status-message error">Failed to send email. Try again.</div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
