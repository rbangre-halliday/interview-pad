import { useState, useRef, useCallback } from 'react'
import FileExplorer from './components/FileExplorer'
import TabBar from './components/TabBar'
import Editor from './components/Editor'
import MarkdownEditor from './components/MarkdownEditor'
import OutputPanel from './components/OutputPanel'
import Toolbar from './components/Toolbar'
import { useFileSystem, get_piston_language } from './hooks/useFileSystem'
import { executeCode, ExecutionResult } from './lib/piston'
import './App.css'

function get_room_id(): string {
  const path = window.location.pathname.slice(1)
  if (path) return path
  const new_id = Math.random().toString(36).substring(2, 10)
  window.history.replaceState(null, '', `/${new_id}`)
  return new_id
}

export default function App() {
  const room_id = get_room_id()
  const {
    files,
    synced,
    output,
    provider,
    get_file_content,
    create_file,
    delete_file,
    set_output,
  } = useFileSystem(room_id)

  const [open_files, set_open_files] = useState<string[]>([])
  const [active_file, set_active_file] = useState<string | null>(null)
  const [is_running, set_is_running] = useState(false)
  const get_code_ref = useRef<(() => string) | null>(null)

  const active_file_info = files.find(f => f.name === active_file)
  const active_ytext = active_file ? get_file_content(active_file) : null
  const piston_lang = active_file ? get_piston_language(active_file) : null
  const can_run = !!piston_lang && active_file_info?.type === 'code'

  const parsed_output: ExecutionResult | null = output ? JSON.parse(output) : null

  const handle_file_select = useCallback((filename: string) => {
    if (!open_files.includes(filename)) {
      set_open_files(prev => [...prev, filename])
    }
    set_active_file(filename)
  }, [open_files])

  const handle_file_create = useCallback((filename: string) => {
    create_file(filename)
    // Auto-open the new file
    set_open_files(prev => [...prev, filename])
    set_active_file(filename)
  }, [create_file])

  const handle_file_delete = useCallback((filename: string) => {
    delete_file(filename)
    // Close tab if open
    set_open_files(prev => prev.filter(f => f !== filename))
    if (active_file === filename) {
      const remaining = open_files.filter(f => f !== filename)
      set_active_file(remaining[0] || null)
    }
  }, [delete_file, active_file, open_files])

  const handle_tab_close = useCallback((filename: string) => {
    set_open_files(prev => {
      const remaining = prev.filter(f => f !== filename)
      if (active_file === filename) {
        const idx = prev.indexOf(filename)
        const new_active = remaining[Math.max(0, idx - 1)] || null
        set_active_file(new_active)
      }
      return remaining
    })
  }, [active_file])

  const handle_run = async () => {
    if (!piston_lang || !get_code_ref.current) return
    const code = get_code_ref.current()
    if (!code) return

    set_is_running(true)
    set_output(null)

    try {
      const result = await executeCode(code, piston_lang.name, piston_lang.version)
      set_output(JSON.stringify(result))
    } catch (err) {
      set_output(JSON.stringify({
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Execution failed',
        compile_output: null,
        status: { id: 0, description: 'Error' },
        time: null,
        memory: null,
      }))
    } finally {
      set_is_running(false)
    }
  }

  const render_editor = () => {
    if (!active_file || !active_ytext) {
      return (
        <div className="empty-state">
          <p>Select a file to edit</p>
        </div>
      )
    }

    if (active_file_info?.type === 'markdown') {
      return (
        <MarkdownEditor
          key={active_file}
          ytext={active_ytext}
          provider={provider}
          synced={synced}
        />
      )
    }

    return (
      <Editor
        key={active_file}
        ytext={active_ytext}
        provider={provider}
        synced={synced}
        language={active_file_info?.language || 'plaintext'}
        on_editor_ready={(get_code) => { get_code_ref.current = get_code }}
      />
    )
  }

  return (
    <div className="app">
      <Toolbar
        room_id={room_id}
        active_file={active_file}
        can_run={can_run}
        is_running={is_running}
        on_run={handle_run}
      />
      <div className="main-container">
        <FileExplorer
          files={files}
          active_file={active_file}
          on_file_select={handle_file_select}
          on_file_create={handle_file_create}
          on_file_delete={handle_file_delete}
        />
        <div className="editor-area">
          <TabBar
            open_files={open_files}
            active_file={active_file}
            on_tab_select={set_active_file}
            on_tab_close={handle_tab_close}
          />
          <div className="editor-content">
            {render_editor()}
          </div>
          {can_run && (
            <div className="output-area">
              <OutputPanel result={parsed_output} is_running={is_running} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
