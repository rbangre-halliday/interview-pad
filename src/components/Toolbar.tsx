import { useState } from 'react'
import UserPresence from './UserPresence'
import { User } from '../hooks/useFileSystem'
import './Toolbar.css'

export interface LanguageOption {
  id: string
  name: string
  extension: string
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'c', name: 'C', extension: 'c' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
]

interface ToolbarProps {
  room_id: string
  can_run: boolean
  is_running: boolean
  current_language: string
  users: User[]
  current_user: User | null
  on_run: () => void
  on_language_change: (lang: LanguageOption) => void
}

export default function Toolbar({
  room_id,
  can_run,
  is_running,
  current_language,
  users,
  current_user,
  on_run,
  on_language_change,
}: ToolbarProps) {
  const [copied, set_copied] = useState(false)

  const handle_copy_link = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    set_copied(true)
    setTimeout(() => set_copied(false), 2000)
  }

  const handle_language_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = LANGUAGES.find(l => l.id === e.target.value)
    if (lang) {
      on_language_change(lang)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Interview Pad</span>
        <span className="toolbar-room">Room: {room_id}</span>
        <UserPresence users={users} current_user={current_user} />
      </div>
      <div className="toolbar-right">
        <select
          className="toolbar-select language-select"
          value={current_language}
          onChange={handle_language_change}
        >
          {LANGUAGES.map(lang => (
            <option key={lang.id} value={lang.id}>
              {lang.name}
            </option>
          ))}
        </select>
        <button
          className="toolbar-button secondary"
          onClick={handle_copy_link}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        {can_run && (
          <button
            className={`toolbar-button primary ${is_running ? 'loading' : ''}`}
            onClick={on_run}
            disabled={is_running}
          >
            {is_running ? 'Running...' : '▶ Run'}
          </button>
        )}
      </div>
    </div>
  )
}
