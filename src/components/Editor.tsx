import { useEffect, useRef } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import { Language } from '../lib/languages'
import './Editor.css'

interface EditorProps {
  language: Language
  ytext: Y.Text | null
  provider: YPartyKitProvider | null
  synced: boolean
  on_editor_ready: (get_code: () => string) => void
}

export default function Editor({ language, ytext, provider, synced, on_editor_ready }: EditorProps) {
  const binding_ref = useRef<MonacoBinding | null>(null)
  const editor_ref = useRef<Parameters<OnMount>[0] | null>(null)

  const handle_mount: OnMount = (editor) => {
    editor_ref.current = editor
    on_editor_ready(() => editor.getValue())
  }

  useEffect(() => {
    if (editor_ref.current && ytext && provider && synced && !binding_ref.current) {
      console.log('Creating Monaco binding after sync')
      binding_ref.current = new MonacoBinding(
        ytext,
        editor_ref.current.getModel()!,
        new Set([editor_ref.current]),
        provider.awareness
      )
    }
  }, [ytext, provider, synced])

  useEffect(() => {
    return () => {
      if (binding_ref.current) {
        binding_ref.current.destroy()
        binding_ref.current = null
      }
    }
  }, [])

  return (
    <div className="editor-container">
      <MonacoEditor
        height="100%"
        language={language.monaco_id}
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
