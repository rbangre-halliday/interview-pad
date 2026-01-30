import { useState, useEffect, useRef } from 'react'
import Editor from './components/Editor'
import OutputPanel from './components/OutputPanel'
import Toolbar from './components/Toolbar'
import { Language, LANGUAGES } from './lib/languages'
import { useYjs } from './hooks/useYjs'
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
  const [is_running, set_is_running] = useState(false)
  const room_id = get_room_id()
  const { ytext, provider, synced, shared_state, set_language_id, set_output } = useYjs(room_id)
  const get_code_ref = useRef<(() => string) | null>(null)

  const language = LANGUAGES.find(l => l.id === shared_state.language_id) || LANGUAGES[0]
  const output: ExecutionResult | null = shared_state.output ? JSON.parse(shared_state.output) : null

  useEffect(() => {
    if (synced && ytext && ytext.length === 0) {
      ytext.insert(0, language.template)
    }
  }, [synced, ytext])

  const handle_language_change = (lang: Language) => {
    set_language_id(lang.id)
  }

  const handle_run = async (code: string) => {
    set_is_running(true)
    set_output(null)
    try {
      const result = await executeCode(code, language.piston_name, language.piston_version)
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

  return (
    <div className="app">
      <Toolbar
        language={language}
        on_language_change={handle_language_change}
        on_run={handle_run}
        is_running={is_running}
        room_id={room_id}
        ytext={ytext}
        get_code={() => get_code_ref.current?.() || ''}
      />
      <div className="main">
        <Editor
          language={language}
          ytext={ytext}
          provider={provider}
          synced={synced}
          on_editor_ready={(get_code) => { get_code_ref.current = get_code }}
        />
        <OutputPanel result={output} is_running={is_running} />
      </div>
    </div>
  )
}
