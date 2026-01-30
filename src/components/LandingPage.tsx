import { useState } from 'react'
import './LandingPage.css'

interface LandingPageProps {
  on_create_room: () => void
  on_join_room: (room_id: string) => void
}

export default function LandingPage({ on_create_room, on_join_room }: LandingPageProps) {
  const [room_code, set_room_code] = useState('')
  const [error, set_error] = useState('')

  const handle_join = () => {
    const code = room_code.trim().toLowerCase()
    if (!code) {
      set_error('Please enter a room code')
      return
    }
    if (code.length < 4) {
      set_error('Room code must be at least 4 characters')
      return
    }
    on_join_room(code)
  }

  const handle_key_down = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handle_join()
    }
  }

  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="landing-header">
          <div className="landing-logo">
            <span className="logo-icon"></span>
            <h1>Interview Pad</h1>
          </div>
          <p className="landing-subtitle">
            Real-time collaborative coding for technical interviews
          </p>
        </div>

        <div className="landing-actions">
          <div className="action-card primary-action">
            <h2>Start New Interview</h2>
            <p>Create a new room and invite your candidate</p>
            <button className="landing-button primary" onClick={on_create_room}>
              Create Room
            </button>
          </div>

          <div className="action-divider">
            <span>or</span>
          </div>

          <div className="action-card">
            <h2>Join Existing Room</h2>
            <p>Enter the room code shared with you</p>
            <div className="join-input-group">
              <input
                type="text"
                className="landing-input"
                placeholder="Enter room code"
                value={room_code}
                onChange={(e) => {
                  set_room_code(e.target.value)
                  set_error('')
                }}
                onKeyDown={handle_key_down}
                autoFocus
              />
              <button className="landing-button secondary" onClick={handle_join}>
                Join
              </button>
            </div>
            {error && <p className="input-error">{error}</p>}
          </div>
        </div>

        <div className="landing-features">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Real-time sync</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🖥</span>
            <span>Multiple languages</span>
          </div>
          <div className="feature">
            <span className="feature-icon">▶</span>
            <span>Code execution</span>
          </div>
        </div>
      </div>
    </div>
  )
}
