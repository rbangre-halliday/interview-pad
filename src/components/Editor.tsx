import { useEffect, useRef } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import './Editor.css'

interface EditorProps {
  ytext: Y.Text | null
  provider: YPartyKitProvider | null
  synced: boolean
  language: string
  on_editor_ready?: (get_code: () => string) => void
}

export default function Editor({ ytext, provider, synced, language, on_editor_ready }: EditorProps) {
  const binding_ref = useRef<MonacoBinding | null>(null)
  const editor_ref = useRef<Parameters<OnMount>[0] | null>(null)
  const initialized_ref = useRef(false)

  const handle_mount: OnMount = (editor) => {
    editor_ref.current = editor
    on_editor_ready?.(() => editor.getValue())

    // If ytext is already available and synced, set up binding immediately
    if (ytext && provider && synced) {
      const content = ytext.toString()
      console.log('Editor mount - setting initial content, length:', content.length)
      editor.setValue(content)

      binding_ref.current = new MonacoBinding(
        ytext,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      )
      initialized_ref.current = true
    }
  }

  useEffect(() => {
    // Only create binding if not already initialized during mount
    if (initialized_ref.current) return
    if (!editor_ref.current || !ytext || !provider || !synced) return

    const content = ytext.toString()
    console.log('Editor useEffect - setting initial content, length:', content.length)

    const model = editor_ref.current.getModel()!
    model.setValue(content)

    binding_ref.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor_ref.current]),
      provider.awareness
    )
    initialized_ref.current = true
  }, [ytext, provider, synced])

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      console.log('Editor unmounting, destroying binding')
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
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
