import { useState } from 'react'
import * as Y from 'yjs'
import { Language, LANGUAGES } from '../lib/languages'
import SessionControls from './SessionControls'
import './Toolbar.css'

interface ToolbarProps {
  language: Language
  on_language_change: (lang: Language) => void
  on_run: (code: string) => void
  is_running: boolean
  room_id: string
  ytext: Y.Text | null
  get_code: () => string
}

export default function Toolbar({
  language,
  on_language_change,
  on_run,
  is_running,
  room_id,
  ytext,
  get_code,
}: ToolbarProps) {
  const [copied, set_copied] = useState(false)

  const handle_run = () => {
    const code = get_code()
    if (!code) return
    on_run(code)
  }

  const handle_copy_link = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    set_copied(true)
    setTimeout(() => set_copied(false), 2000)
  }

  const handle_language_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = LANGUAGES.find((l) => l.id === e.target.value)
    if (lang && ytext) {
      on_language_change(lang)
      if (ytext.length === 0) {
        ytext.insert(0, lang.template)
      }
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Interview Pad</span>
        <span className="toolbar-room">Room: {room_id}</span>
      </div>
      <div className="toolbar-right">
        <select
          className="toolbar-select"
          value={language.id}
          onChange={handle_language_change}
        >
          {LANGUAGES.map((lang) => (
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
        <button
          className="toolbar-button primary"
          onClick={handle_run}
          disabled={is_running}
        >
          {is_running ? 'Running...' : 'Run'}
        </button>
        <SessionControls ytext={ytext} language={language} room_id={room_id} />
      </div>
    </div>
  )
}
