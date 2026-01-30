import { useState } from 'react'
import './JoinRoom.css'

export type UserRole = 'interviewer' | 'candidate'
export type JoinMode = 'create' | 'join'

interface JoinRoomProps {
  room_id: string
  mode: JoinMode
  on_join: (name: string, role: UserRole) => void
  on_back: () => void
}

export default function JoinRoom({ room_id, mode, on_join, on_back }: JoinRoomProps) {
  const [name, set_name] = useState('')
  const [role, set_role] = useState<UserRole | null>(mode === 'create' ? 'interviewer' : null)
  const [error, set_error] = useState('')

  const is_creating = mode === 'create'

  const handle_join = () => {
    const trimmed_name = name.trim()
    if (!trimmed_name) {
      set_error('Please enter your name')
      return
    }
    if (!role) {
      set_error('Please select your role')
      return
    }
    on_join(trimmed_name, role)
  }

  const handle_key_down = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && role) {
      handle_join()
    }
  }

  return (
    <div className="join-room">
      <div className="join-content">
        <button className="back-button" onClick={on_back}>
          ← Back
        </button>

        <div className="join-header">
          <h1>{is_creating ? 'Create Interview' : 'Join Interview'}</h1>
          <div className="room-badge">
            <span className="room-label">Room</span>
            <span className="room-code">{room_id}</span>
          </div>
        </div>

        <div className="join-form">
          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              className="join-input"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => {
                set_name(e.target.value)
                set_error('')
              }}
              onKeyDown={handle_key_down}
              autoFocus
            />
          </div>

          {/* Only show role selection when joining, not creating */}
          {!is_creating && (
            <div className="form-group">
              <label>Your Role</label>
              <div className="role-options">
                <button
                  className={`role-option ${role === 'interviewer' ? 'selected' : ''}`}
                  onClick={() => {
                    set_role('interviewer')
                    set_error('')
                  }}
                >
                  <span className="role-icon">👔</span>
                  <span className="role-name">Interviewer</span>
                  <span className="role-desc">Conducting the interview</span>
                </button>
                <button
                  className={`role-option ${role === 'candidate' ? 'selected' : ''}`}
                  onClick={() => {
                    set_role('candidate')
                    set_error('')
                  }}
                >
                  <span className="role-icon">💻</span>
                  <span className="role-name">Candidate</span>
                  <span className="role-desc">Taking the interview</span>
                </button>
              </div>
            </div>
          )}

          {is_creating && (
            <div className="role-info">
              <span className="role-icon">👔</span>
              <span>You'll join as <strong>Interviewer</strong></span>
            </div>
          )}

          {error && <p className="join-error">{error}</p>}

          <button
            className="join-button"
            onClick={handle_join}
            disabled={!name.trim() || !role}
          >
            {is_creating ? 'Create & Join' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
