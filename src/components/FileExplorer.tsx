import { useState } from 'react'
import { FileInfo } from '../hooks/useFileSystem'
import './FileExplorer.css'

interface FileExplorerProps {
  files: FileInfo[]
  active_file: string | null
  on_file_select: (filename: string) => void
  on_file_create: (filename: string) => void
  on_file_delete: (filename: string) => void
}

function get_file_icon(file: FileInfo): string {
  if (file.type === 'markdown') return '📄'
  if (file.type === 'whiteboard') return '🎨'
  if (file.language === 'python') return '🐍'
  if (file.language === 'javascript' || file.language === 'typescript') return '📜'
  if (file.language === 'java') return '☕'
  if (file.language === 'c' || file.language === 'cpp') return '⚙️'
  return '📝'
}

export default function FileExplorer({
  files,
  active_file,
  on_file_select,
  on_file_create,
  on_file_delete,
}: FileExplorerProps) {
  const [is_creating, set_is_creating] = useState(false)
  const [new_filename, set_new_filename] = useState('')
  const [context_menu, set_context_menu] = useState<{ x: number; y: number; file: string } | null>(null)

  const handle_create = () => {
    if (new_filename.trim()) {
      on_file_create(new_filename.trim())
      set_new_filename('')
      set_is_creating(false)
    }
  }

  const handle_key_down = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handle_create()
    } else if (e.key === 'Escape') {
      set_is_creating(false)
      set_new_filename('')
    }
  }

  const handle_context_menu = (e: React.MouseEvent, filename: string) => {
    e.preventDefault()
    set_context_menu({ x: e.clientX, y: e.clientY, file: filename })
  }

  const handle_delete = () => {
    if (context_menu) {
      on_file_delete(context_menu.file)
      set_context_menu(null)
    }
  }

  return (
    <div className="file-explorer" onClick={() => set_context_menu(null)}>
      <div className="explorer-header">
        <span>EXPLORER</span>
      </div>
      <div className="explorer-section">
        <div className="section-header">
          <span>FILES</span>
          <button
            className="add-file-btn"
            onClick={() => set_is_creating(true)}
            title="New File"
          >
            +
          </button>
        </div>
        <div className="file-list">
          {files.map((file) => (
            <div
              key={file.name}
              className={`file-item ${active_file === file.name ? 'active' : ''}`}
              onClick={() => on_file_select(file.name)}
              onContextMenu={(e) => handle_context_menu(e, file.name)}
            >
              <span className="file-icon">{get_file_icon(file)}</span>
              <span className="file-name">{file.name}</span>
            </div>
          ))}
          {is_creating && (
            <div className="file-item creating">
              <span className="file-icon">📝</span>
              <input
                type="text"
                value={new_filename}
                onChange={(e) => set_new_filename(e.target.value)}
                onKeyDown={handle_key_down}
                onBlur={handle_create}
                placeholder="filename.ext"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {context_menu && (
        <div
          className="context-menu"
          style={{ top: context_menu.y, left: context_menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handle_delete}>🗑 Delete</button>
        </div>
      )}
    </div>
  )
}
