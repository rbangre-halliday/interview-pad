import { useEffect, useRef, useState, useCallback } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import { useTheme } from '../hooks/useTheme'
import './MarkdownEditor.css'

function CollapsibleCode({ children, className }: { children: React.ReactNode; className?: string }) {
  const [collapsed, set_collapsed] = useState(false)
  const language = className?.replace('language-', '') || 'code'
  const code_string = String(children).replace(/\n$/, '')
  const line_count = code_string.split('\n').length

  return (
    <div className={`collapsible-code ${collapsed ? 'collapsed' : ''}`}>
      <button className="code-toggle" onClick={() => set_collapsed(!collapsed)}>
        <span className="toggle-icon">{collapsed ? '▶' : '▼'}</span>
        <span className="code-language">{language}</span>
        <span className="code-lines">{line_count} lines</span>
      </button>
      {!collapsed && (
        <pre className={className}>
          <code>{children}</code>
        </pre>
      )}
    </div>
  )
}

const markdown_components: Components = {
  code({ className, children, ...props }) {
    const is_inline = !className && !String(children).includes('\n')
    if (is_inline) {
      return <code className="inline-code" {...props}>{children}</code>
    }
    return <CollapsibleCode className={className}>{children}</CollapsibleCode>
  }
}

interface MarkdownEditorProps {
  ytext: Y.Text | null
  provider: YPartyKitProvider | null
  synced: boolean
  is_candidate?: boolean
}

export default function MarkdownEditor({ ytext, provider, synced, is_candidate = false }: MarkdownEditorProps) {
  const theme = useTheme()
  const [content, set_content] = useState('')
  const [editor_width, set_editor_width] = useState(35) // Editor takes 35% by default
  const [editor_collapsed, set_editor_collapsed] = useState(is_candidate) // Collapsed by default for candidates
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
      <div className="markdown-pane preview-pane" style={{ flex: editor_collapsed ? '1 1 auto' : `0 0 ${100 - editor_width}%` }}>
        <div className="pane-header">
          <span className="pane-icon">◉</span>
          Preview
        </div>
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdown_components}>{content}</ReactMarkdown>
        </div>
      </div>

      {/* Resize handle - only show when editor is expanded */}
      {!editor_collapsed && (
        <div className="pane-resize-handle" onMouseDown={handle_resize_start}>
          <div className="resize-grip" />
        </div>
      )}

      {/* Editor on right - collapsible */}
      <div className={`markdown-pane editor-pane ${editor_collapsed ? 'collapsed' : ''}`} style={{ flex: editor_collapsed ? '0 0 auto' : `0 0 ${editor_width}%` }}>
        <button className="pane-header pane-toggle" onClick={() => set_editor_collapsed(!editor_collapsed)}>
          <span className="toggle-icon">{editor_collapsed ? '◀' : '▶'}</span>
          <span className="pane-label">Edit</span>
        </button>
        {!editor_collapsed && (
          <MonacoEditor
            height="100%"
            language="markdown"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
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
        )}
      </div>
    </div>
  )
}
