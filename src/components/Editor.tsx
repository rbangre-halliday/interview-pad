import { useEffect, useRef } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import type * as Monaco from 'monaco-editor'
import './Editor.css'

interface EditorProps {
  ytext: Y.Text | null
  provider: YPartyKitProvider | null
  synced: boolean
  language: string
  on_editor_ready?: (get_code: () => string) => void
}

interface RemoteCursor {
  decoration_ids: string[]
  line: number
  column: number
  color: string
  name: string
  last_activity: number
}

export default function Editor({ ytext, provider, synced, language, on_editor_ready }: EditorProps) {
  const binding_ref = useRef<MonacoBinding | null>(null)
  const editor_ref = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monaco_ref = useRef<typeof Monaco | null>(null)
  const initialized_ref = useRef(false)
  const cursors_ref = useRef<Map<number, RemoteCursor>>(new Map())
  const cleanup_ref = useRef<(() => void) | null>(null)
  const hover_widget_ref = useRef<Monaco.editor.IContentWidget | null>(null)

  const handle_mount: OnMount = (editor, monaco) => {
    editor_ref.current = editor
    monaco_ref.current = monaco
    on_editor_ready?.(() => editor.getValue())

    if (ytext && provider && synced) {
      const content = ytext.toString()
      editor.setValue(content)

      binding_ref.current = new MonacoBinding(
        ytext,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      )
      initialized_ref.current = true

      cleanup_ref.current = setup_cursor_tracking(editor, monaco, provider)
    }
  }

  const setup_cursor_tracking = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    provider: YPartyKitProvider
  ) => {
    const awareness = provider.awareness
    let hover_timeout: number | null = null

    // Broadcast cursor position
    const broadcast_cursor = () => {
      const position = editor.getPosition()
      if (position) {
        awareness.setLocalStateField('cursor_pos', {
          line: position.lineNumber,
          column: position.column,
          timestamp: Date.now(),
        })
      }
    }

    const cursor_listener = editor.onDidChangeCursorPosition(broadcast_cursor)
    broadcast_cursor()

    // Create hover widget for showing name
    const create_hover_widget = (name: string, color: string, position: Monaco.Position, position_below = false) => {
      // Remove existing hover widget
      if (hover_widget_ref.current) {
        editor.removeContentWidget(hover_widget_ref.current)
      }

      const dom_node = document.createElement('div')
      dom_node.className = 'cursor-name-tooltip'
      dom_node.style.setProperty('--cursor-color', color)
      dom_node.textContent = name

      const preference = position_below
        ? [monaco.editor.ContentWidgetPositionPreference.BELOW]
        : [monaco.editor.ContentWidgetPositionPreference.ABOVE]

      const widget: Monaco.editor.IContentWidget = {
        getId: () => 'cursor-hover-widget',
        getDomNode: () => dom_node,
        getPosition: () => ({
          position,
          preference,
        }),
      }

      editor.addContentWidget(widget)
      hover_widget_ref.current = widget

      // Auto-hide after 2 seconds
      if (hover_timeout) clearTimeout(hover_timeout)
      hover_timeout = window.setTimeout(() => {
        if (hover_widget_ref.current) {
          editor.removeContentWidget(hover_widget_ref.current)
          hover_widget_ref.current = null
        }
      }, 2000)
    }

    // Render remote cursors as decorations
    const update_remote_cursors = () => {
      const states = awareness.getStates()
      const model = editor.getModel()
      if (!model) return

      const my_client_id = awareness.clientID
      const active_clients = new Set<number>()
      const now = Date.now()

      states.forEach((state, client_id) => {
        if (client_id === my_client_id) return
        if (!state.user || !state.cursor_pos) return

        active_clients.add(client_id)

        const { line, column, timestamp } = state.cursor_pos
        const color = state.user.color || '#6366f1'
        const name = state.user.name || 'User'
        const is_recent = (now - (timestamp || 0)) < 5000

        let cursor = cursors_ref.current.get(client_id)

        // Clear old decorations
        if (cursor?.decoration_ids.length) {
          editor.deltaDecorations(cursor.decoration_ids, [])
        }

        // Create new decorations - subtle colored line
        const decoration_ids = editor.deltaDecorations([], [
          {
            range: new monaco.Range(line, column, line, column),
            options: {
              className: `remote-cursor ${is_recent ? 'active' : 'idle'}`,
              beforeContentClassName: `remote-cursor-line`,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          },
          // Subtle line highlight
          {
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className: `remote-cursor-line-highlight`,
            },
          },
        ])

        // Inject color via CSS custom property
        requestAnimationFrame(() => {
          const cursor_elements = document.querySelectorAll('.remote-cursor-line')
          cursor_elements.forEach(el => {
            (el as HTMLElement).style.setProperty('--cursor-color', color)
          })
          const line_elements = document.querySelectorAll('.remote-cursor-line-highlight')
          line_elements.forEach(el => {
            (el as HTMLElement).style.setProperty('--cursor-color', color)
          })
        })

        cursors_ref.current.set(client_id, {
          decoration_ids,
          line,
          column,
          color,
          name,
          last_activity: timestamp || now,
        })
      })

      // Remove cursors for disconnected users
      cursors_ref.current.forEach((cursor, client_id) => {
        if (!active_clients.has(client_id)) {
          editor.deltaDecorations(cursor.decoration_ids, [])
          cursors_ref.current.delete(client_id)
        }
      })
    }

    awareness.on('change', update_remote_cursors)
    update_remote_cursors()

    // Show name on hover near cursor
    const mouse_move_listener = editor.onMouseMove((e) => {
      if (!e.target.position) return

      const hover_line = e.target.position.lineNumber
      const hover_col = e.target.position.column

      // Check if hovering near any remote cursor
      cursors_ref.current.forEach((cursor) => {
        const distance = Math.abs(cursor.line - hover_line) + Math.abs(cursor.column - hover_col)
        if (distance < 3) {
          // Position below if near top of editor
          const position_below = cursor.line <= 2
          create_hover_widget(
            cursor.name,
            cursor.color,
            new monaco.Position(cursor.line, cursor.column),
            position_below
          )
        }
      })
    })

    return () => {
      cursor_listener.dispose()
      mouse_move_listener.dispose()
      awareness.off('change', update_remote_cursors)
      if (hover_timeout) clearTimeout(hover_timeout)
      if (hover_widget_ref.current) {
        editor.removeContentWidget(hover_widget_ref.current)
      }
      cursors_ref.current.forEach((cursor) => {
        editor.deltaDecorations(cursor.decoration_ids, [])
      })
      cursors_ref.current.clear()
    }
  }

  useEffect(() => {
    if (initialized_ref.current) return
    if (!editor_ref.current || !monaco_ref.current || !ytext || !provider || !synced) return

    const content = ytext.toString()
    const model = editor_ref.current.getModel()!
    model.setValue(content)

    binding_ref.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor_ref.current]),
      provider.awareness
    )
    initialized_ref.current = true

    cleanup_ref.current = setup_cursor_tracking(editor_ref.current, monaco_ref.current, provider)
  }, [ytext, provider, synced])

  useEffect(() => {
    return () => {
      if (cleanup_ref.current) {
        cleanup_ref.current()
        cleanup_ref.current = null
      }
      if (binding_ref.current) {
        binding_ref.current.destroy()
        binding_ref.current = null
      }
      initialized_ref.current = false
    }
  }, [])

  return (
    <div className="editor-container">
      <MonacoEditor
        height="100%"
        language={language}
        theme="vs-dark"
        onMount={handle_mount}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
          renderLineHighlight: 'none',
          'semanticHighlighting.enabled': true,
        }}
      />
    </div>
  )
}
