import { useEffect, useRef, useState } from 'react'
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
  const binding_ref = useRef<MonacoBinding | null>(null)
  const editor_ref = useRef<Parameters<OnMount>[0] | null>(null)
  const initialized_ref = useRef(false)

  const handle_mount: OnMount = (editor) => {
    editor_ref.current = editor

    // If ytext is already available and synced, set up binding immediately
    if (ytext && provider && synced) {
      const ytext_content = ytext.toString()
      console.log('MarkdownEditor mount - setting initial content, length:', ytext_content.length)
      editor.setValue(ytext_content)
      set_content(ytext_content)

      binding_ref.current = new MonacoBinding(
        ytext,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      )

      // Update preview when ytext changes
      const update_preview = () => set_content(ytext.toString())
      ytext.observe(update_preview)

      initialized_ref.current = true
    }
  }

  useEffect(() => {
    // Only create binding if not already initialized during mount
    if (initialized_ref.current) return
    if (!editor_ref.current || !ytext || !provider || !synced) return

    const ytext_content = ytext.toString()
    console.log('MarkdownEditor useEffect - setting initial content, length:', ytext_content.length)

    const model = editor_ref.current.getModel()!
    model.setValue(ytext_content)
    set_content(ytext_content)

    binding_ref.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor_ref.current]),
      provider.awareness
    )

    // Update preview when ytext changes
    const update_preview = () => set_content(ytext.toString())
    ytext.observe(update_preview)

    initialized_ref.current = true

    return () => {
      ytext.unobserve(update_preview)
    }
  }, [ytext, provider, synced])

  // Keep preview updated when ytext changes (for real-time sync)
  useEffect(() => {
    if (!ytext) return
    const update_preview = () => set_content(ytext.toString())
    ytext.observe(update_preview)
    return () => ytext.unobserve(update_preview)
  }, [ytext])

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      console.log('MarkdownEditor unmounting, destroying binding')
      if (binding_ref.current) {
        binding_ref.current.destroy()
        binding_ref.current = null
      }
      initialized_ref.current = false
    }
  }, [])

  return (
    <div className="markdown-editor">
      <div className="markdown-pane editor-pane">
        <div className="pane-header">Edit</div>
        <MonacoEditor
          height="100%"
          language="markdown"
          theme="vs-dark"
          onMount={handle_mount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
      <div className="markdown-pane preview-pane">
        <div className="pane-header">Preview</div>
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
