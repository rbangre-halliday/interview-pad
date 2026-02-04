import { useEffect, useRef, useState, useCallback } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import './MarkdownEditor.css'

interface MarkdownEditorProps {
  ytext: Y.Text | null
  provider: YPartyKitProvider | null
  synced: boolean
}

export default function MarkdownEditor({ ytext, provider, synced }: MarkdownEditorProps) {
  const [content, set_content] = useState('')
  const [editor_width, set_editor_width] = useState(35) // Editor takes 35% by default
  const binding_ref = useRef<MonacoBinding | null>(null)
  const editor_ref = useRef<Parameters<OnMount>[0] | null>(null)
  const initialized_ref = useRef(false)
  const resize_ref = useRef<{ start_x: number; start_width: number } | null>(null)
  const container_ref = useRef<HTMLDivElement | null>(null)

  const handle_mount: OnMount = (editor) => {
    editor_ref.current = editor

    if (ytext && provider && synced) {
      const ytext_content = ytext.toString()
      editor.setValue(ytext_content)
      set_content(ytext_content)

      binding_ref.current = new MonacoBinding(
        ytext,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      )

      const update_preview = () => set_content(ytext.toString())
      ytext.observe(update_preview)

      initialized_ref.current = true
    }
  }

  const handle_resize_start = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resize_ref.current = {
      start_x: e.clientX,
      start_width: editor_width,
    }

    const handle_mouse_move = (e: MouseEvent) => {
      if (!resize_ref.current || !container_ref.current) return
      const container_width = container_ref.current.offsetWidth
      const delta_x = e.clientX - resize_ref.current.start_x
      const delta_percent = (delta_x / container_width) * 100
      // Moving right shrinks editor (gives more space to preview on the left)
      const new_width = Math.max(20, Math.min(80, resize_ref.current.start_width - delta_percent))
      set_editor_width(new_width)
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
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [editor_width])

  useEffect(() => {
    if (initialized_ref.current) return
    if (!editor_ref.current || !ytext || !provider || !synced) return

    const ytext_content = ytext.toString()
    const model = editor_ref.current.getModel()!
    model.setValue(ytext_content)
    set_content(ytext_content)

    binding_ref.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor_ref.current]),
      provider.awareness
    )

    const update_preview = () => set_content(ytext.toString())
    ytext.observe(update_preview)

    initialized_ref.current = true

    return () => {
      ytext.unobserve(update_preview)
    }
  }, [ytext, provider, synced])

  useEffect(() => {
    if (!ytext) return
    // Set initial content immediately when ytext becomes available
    set_content(ytext.toString())
    const update_preview = () => set_content(ytext.toString())
    ytext.observe(update_preview)
    return () => ytext.unobserve(update_preview)
  }, [ytext])

  useEffect(() => {
    return () => {
      if (binding_ref.current) {
        binding_ref.current.destroy()
        binding_ref.current = null
      }
      initialized_ref.current = false
    }
  }, [])

  return (
    <div className="markdown-editor" ref={container_ref}>
      {/* Preview on left - takes remaining space */}
      <div className="markdown-pane preview-pane" style={{ flex: `0 0 ${100 - editor_width}%` }}>
        <div className="pane-header">
          <span className="pane-icon">◉</span>
          Preview
        </div>
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>

      {/* Resize handle */}
      <div className="pane-resize-handle" onMouseDown={handle_resize_start}>
        <div className="resize-grip" />
      </div>

      {/* Editor on right */}
      <div className="markdown-pane editor-pane" style={{ flex: `0 0 ${editor_width}%` }}>
        <div className="pane-header">
          <span className="pane-icon">{ }</span>
          Edit
        </div>
        <MonacoEditor
          height="100%"
          language="markdown"
          theme="vs-dark"
          onMount={handle_mount}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            renderLineHighlight: 'none',
          }}
        />
      </div>
    </div>
  )
}
