import { useState } from 'react'
import './Toolbar.css'

interface ToolbarProps {
  room_id: string
  active_file: string | null
  can_run: boolean
  is_running: boolean
  on_run: () => void
}

export default function Toolbar({
  room_id,
  active_file,
  can_run,
  is_running,
  on_run,
}: ToolbarProps) {
  const [copied, set_copied] = useState(false)

  const handle_copy_link = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    set_copied(true)
    setTimeout(() => set_copied(false), 2000)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Interview Pad</span>
        <span className="toolbar-room">Room: {room_id}</span>
      </div>
      <div className="toolbar-right">
        {active_file && (
          <span className="toolbar-file">{active_file}</span>
        )}
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
