import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import JoinRoom, { UserRole } from './components/JoinRoom'
import FileExplorer from './components/FileExplorer'
import TabBar from './components/TabBar'
import Editor from './components/Editor'
import MarkdownEditor from './components/MarkdownEditor'
import Whiteboard from './components/Whiteboard'
import OutputPanel from './components/OutputPanel'
import Toolbar, { LANGUAGES, LanguageOption } from './components/Toolbar'
import { useFileSystem, get_piston_language } from './hooks/useFileSystem'
import { executeCode, ExecutionResult } from './lib/piston'
import './App.css'

interface StoredUser {
  name: string
  role: UserRole
}

function get_stored_user(room_id: string): StoredUser | null {
  try {
    // Use sessionStorage so each tab has its own session
    const data = sessionStorage.getItem(`interview-pad-user-${room_id}`)
    if (data) {
      return JSON.parse(data)
    }
  } catch {
    // ignore
  }
  return null
}

function store_user(room_id: string, user: StoredUser) {
  sessionStorage.setItem(`interview-pad-user-${room_id}`, JSON.stringify(user))
}

function get_room_id_from_url(): string | null {
  const path = window.location.pathname.slice(1)
  return path || null
}

type JoinMode = 'create' | 'join'

function generate_room_id(): string {
  return Math.random().toString(36).substring(2, 10)
}

function get_language_from_file(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const lang = LANGUAGES.find(l => l.extension === ext)
  return lang?.id || 'python'
}

export default function App() {
  const [room_id, set_room_id] = useState<string | null>(get_room_id_from_url)
  const [join_mode, set_join_mode] = useState<JoinMode | null>(null)
  const [user, set_user] = useState<StoredUser | null>(() => {
    const rid = get_room_id_from_url()
    return rid ? get_stored_user(rid) : null
  })

  // Handle browser back/forward
  useEffect(() => {
    const handle_popstate = () => {
      const new_room_id = get_room_id_from_url()
      set_room_id(new_room_id)
      if (new_room_id) {
        set_user(get_stored_user(new_room_id))
      } else {
        set_user(null)
      }
    }
    window.addEventListener('popstate', handle_popstate)
    return () => window.removeEventListener('popstate', handle_popstate)
  }, [])

  const handle_create_room = () => {
    const new_id = generate_room_id()
    window.history.pushState(null, '', `/${new_id}`)
    set_room_id(new_id)
    set_join_mode('create')
  }

  const handle_join_room = (code: string) => {
    window.history.pushState(null, '', `/${code}`)
    set_room_id(code)
    set_join_mode('join')
    // Check if we have stored credentials for this room
    const stored = get_stored_user(code)
    if (stored) {
      set_user(stored)
    }
  }

  const handle_user_join = (name: string, role: UserRole) => {
    if (!room_id) return
    const new_user = { name, role }
    store_user(room_id, new_user)
    set_user(new_user)
  }

  const handle_back_to_landing = () => {
    window.history.pushState(null, '', '/')
    set_room_id(null)
    set_join_mode(null)
    set_user(null)
  }

  // Show landing page if no room ID
  if (!room_id) {
    return (
      <LandingPage
        on_create_room={handle_create_room}
        on_join_room={handle_join_room}
      />
    )
  }

  // Show join screen if room ID but no user
  // If no join_mode (e.g., direct URL access), default to 'join' (candidate)
  if (!user) {
    return (
      <JoinRoom
        room_id={room_id}
        mode={join_mode || 'join'}
        on_join={handle_user_join}
        on_back={handle_back_to_landing}
      />
    )
  }

  // Show main editor
  return (
    <InterviewRoom
      room_id={room_id}
      user={user}
    />
  )
}

interface InterviewRoomProps {
  room_id: string
  user: StoredUser
}

function InterviewRoom({ room_id, user }: InterviewRoomProps) {
  const {
    files,
    synced,
    output,
    provider,
    users,
    current_user,
    get_file_content,
    get_whiteboard_data,
    create_file,
    delete_file,
    set_output,
  } = useFileSystem(room_id, user.name, user.role)

  const [open_files, set_open_files] = useState<string[]>([])
  const [active_file, set_active_file] = useState<string | null>(null)
  const [is_running, set_is_running] = useState(false)
  const [output_height, set_output_height] = useState(200)
  const [initialized, set_initialized] = useState(false)
  const get_code_ref = useRef<(() => string) | null>(null)
  const resize_ref = useRef<{ start_y: number; start_height: number } | null>(null)

  // Auto-open question.md when room first syncs with files
  useEffect(() => {
    if (initialized || !synced || files.length === 0) return
    const question = files.find(f => f.name === 'question.md')
    if (question) {
      set_open_files([question.name])
      set_active_file(question.name)
    } else if (files.length > 0) {
      set_open_files([files[0].name])
      set_active_file(files[0].name)
    }
    set_initialized(true)
  }, [synced, files, initialized])

  const active_file_info = files.find(f => f.name === active_file)
  const active_ytext = active_file ? get_file_content(active_file) : null
  const piston_lang = active_file ? get_piston_language(active_file) : null
  const can_run = !!piston_lang && active_file_info?.type === 'code'

  const parsed_output: ExecutionResult | null = output ? JSON.parse(output) : null

  // Find the current solution file and its language
  const current_solution = useMemo(() => {
    const solution_file = files.find(f => f.name.startsWith('solution.'))
    if (solution_file) {
      return {
        filename: solution_file.name,
        language: get_language_from_file(solution_file.name)
      }
    }
    return { filename: 'solution.py', language: 'python' }
  }, [files])

  const handle_file_select = useCallback((filename: string) => {
    if (!open_files.includes(filename)) {
      set_open_files(prev => [...prev, filename])
    }
    set_active_file(filename)
  }, [open_files])

  const handle_file_create = useCallback((filename: string) => {
    create_file(filename)
    set_open_files(prev => [...prev, filename])
    set_active_file(filename)
  }, [create_file])

  const handle_file_delete = useCallback((filename: string) => {
    delete_file(filename)
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

  const handle_language_change = useCallback((lang: LanguageOption) => {
    const old_filename = current_solution.filename
    const new_filename = `solution.${lang.extension}`

    if (old_filename === new_filename) return

    delete_file(old_filename)
    create_file(new_filename)

    set_open_files(prev => {
      const filtered = prev.filter(f => f !== old_filename)
      return [...filtered, new_filename]
    })
    set_active_file(new_filename)
    set_output(null)
  }, [current_solution.filename, delete_file, create_file, set_output])

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

  const handle_resize_start = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resize_ref.current = {
      start_y: e.clientY,
      start_height: output_height,
    }

    const handle_mouse_move = (e: MouseEvent) => {
      if (!resize_ref.current) return
      const delta = resize_ref.current.start_y - e.clientY
      const new_height = Math.max(100, Math.min(500, resize_ref.current.start_height + delta))
      set_output_height(new_height)
    }

    const handle_mouse_up = () => {
      resize_ref.current = null
      document.removeEventListener('mousemove', handle_mouse_move)
      document.removeEventListener('mouseup', handle_mouse_up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handle_mouse_move)
    document.addEventListener('mouseup', handle_mouse_up)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [output_height])

  const render_editor = () => {
    if (!active_file) {
      return (
        <div className="empty-state">
          <p>Select a file to edit</p>
        </div>
      )
    }

    if (active_file_info?.type === 'whiteboard') {
      const ymap = get_whiteboard_data(active_file)
      return (
        <Whiteboard
          key={active_file}
          ymap={ymap}
          provider={provider}
          synced={synced}
        />
      )
    }

    if (!active_ytext) {
      return (
        <div className="empty-state">
          <p>Loading...</p>
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
          is_candidate={user.role === 'candidate'}
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
        can_run={can_run}
        is_running={is_running}
        current_language={current_solution.language}
        users={users}
        current_user={current_user}
        on_run={handle_run}
        on_language_change={handle_language_change}
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
            <>
              <div className="resize-handle" onMouseDown={handle_resize_start} />
              <div className="output-area" style={{ height: output_height }}>
                <OutputPanel result={parsed_output} is_running={is_running} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
