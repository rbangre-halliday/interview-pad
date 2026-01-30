import './TabBar.css'

interface TabBarProps {
  open_files: string[]
  active_file: string | null
  on_tab_select: (filename: string) => void
  on_tab_close: (filename: string) => void
}

export default function TabBar({
  open_files,
  active_file,
  on_tab_select,
  on_tab_close,
}: TabBarProps) {
  const handle_close = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation()
    on_tab_close(filename)
  }

  return (
    <div className="tab-bar">
      {open_files.map((filename) => (
        <div
          key={filename}
          className={`tab ${active_file === filename ? 'active' : ''}`}
          onClick={() => on_tab_select(filename)}
        >
          <span className="tab-name">{filename}</span>
          <button
            className="tab-close"
            onClick={(e) => handle_close(e, filename)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
