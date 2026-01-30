import { useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || '127.0.0.1:1999'

export interface FileInfo {
  name: string
  type: 'code' | 'markdown' | 'text'
  language?: string
}

const DEFAULT_README = `# Interview Problem

## Description
Describe the problem here...

## Examples
\`\`\`
Input: ...
Output: ...
\`\`\`

## Constraints
- ...
`

const DEFAULT_SOLUTION = `# Write your solution here

def solution():
    pass

if __name__ == "__main__":
    solution()
`

function get_file_type(filename: string): 'code' | 'markdown' | 'text' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (['py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext || '')) return 'code'
  return 'text'
}

function get_language_from_extension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    go: 'go',
    rs: 'rust',
    md: 'markdown',
    txt: 'plaintext',
  }
  return map[ext || ''] || 'plaintext'
}

export function get_piston_language(filename: string): { name: string; version: string } | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, { name: string; version: string }> = {
    py: { name: 'python', version: '*' },
    js: { name: 'javascript', version: '*' },
    ts: { name: 'typescript', version: '*' },
    java: { name: 'java', version: '*' },
    c: { name: 'c', version: '*' },
    cpp: { name: 'c++', version: '*' },
  }
  return map[ext || ''] || null
}

export function useFileSystem(room_id: string) {
  const [files, set_files] = useState<FileInfo[]>([])
  const [synced, set_synced] = useState(false)
  const [output, set_output_state] = useState<string | null>(null)
  const [provider, set_provider] = useState<YPartyKitProvider | null>(null)
  const [, force_update] = useState(0)

  const doc_ref = useRef<Y.Doc | null>(null)
  const provider_ref = useRef<YPartyKitProvider | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    doc_ref.current = doc

    const provider_instance = new YPartyKitProvider(PARTYKIT_HOST, room_id, doc)
    provider_ref.current = provider_instance
    set_provider(provider_instance)

    // Single shared text for the entire editor content
    // We'll use a Y.Map to track which file is active and store file list
    const meta = doc.getMap<string>('meta')

    const update_state = () => {
      const file_list_json = meta.get('files') || '[]'
      try {
        const names: string[] = JSON.parse(file_list_json)
        const file_infos: FileInfo[] = names.map(name => ({
          name,
          type: get_file_type(name),
          language: get_language_from_extension(name),
        }))
        file_infos.sort((a, b) => a.name.localeCompare(b.name))
        set_files(file_infos)
      } catch {
        set_files([])
      }
      set_output_state(meta.get('output') || null)
      force_update(n => n + 1)
    }

    meta.observe(update_state)

    provider_instance.on('sync', (is_synced: boolean) => {
      console.log('FileSystem synced:', is_synced)
      set_synced(is_synced)

      if (is_synced) {
        const file_list_json = meta.get('files')
        if (!file_list_json) {
          // Initialize default files
          const default_files = ['README.md', 'solution.py']
          meta.set('files', JSON.stringify(default_files))

          // Initialize file contents
          const readme_text = doc.getText('file:README.md')
          if (readme_text.length === 0) {
            readme_text.insert(0, DEFAULT_README)
          }

          const solution_text = doc.getText('file:solution.py')
          if (solution_text.length === 0) {
            solution_text.insert(0, DEFAULT_SOLUTION)
          }
        }
        update_state()
      }
    })

    return () => {
      provider_instance.destroy()
      doc.destroy()
    }
  }, [room_id])

  const get_file_content = useCallback((filename: string): Y.Text | null => {
    if (!doc_ref.current) return null
    const ytext = doc_ref.current.getText(`file:${filename}`)
    console.log(`get_file_content(${filename}): length=${ytext.length}, content="${ytext.toString().substring(0, 30)}..."`)
    return ytext
  }, [])

  const create_file = useCallback((filename: string, content: string = '') => {
    if (!doc_ref.current) return
    const meta = doc_ref.current.getMap<string>('meta')
    const file_list_json = meta.get('files') || '[]'
    const names: string[] = JSON.parse(file_list_json)

    if (names.includes(filename)) return // Already exists

    names.push(filename)
    meta.set('files', JSON.stringify(names))

    if (content) {
      const ytext = doc_ref.current.getText(`file:${filename}`)
      ytext.insert(0, content)
    }
  }, [])

  const delete_file = useCallback((filename: string) => {
    if (!doc_ref.current) return
    const meta = doc_ref.current.getMap<string>('meta')
    const file_list_json = meta.get('files') || '[]'
    const names: string[] = JSON.parse(file_list_json)

    const idx = names.indexOf(filename)
    if (idx !== -1) {
      names.splice(idx, 1)
      meta.set('files', JSON.stringify(names))
    }
  }, [])

  const rename_file = useCallback((old_name: string, new_name: string) => {
    if (!doc_ref.current) return
    const meta = doc_ref.current.getMap<string>('meta')
    const file_list_json = meta.get('files') || '[]'
    const names: string[] = JSON.parse(file_list_json)

    if (names.includes(new_name)) return // Target exists
    const idx = names.indexOf(old_name)
    if (idx === -1) return

    const old_content = doc_ref.current.getText(`file:${old_name}`).toString()

    names[idx] = new_name
    meta.set('files', JSON.stringify(names))

    const new_ytext = doc_ref.current.getText(`file:${new_name}`)
    new_ytext.insert(0, old_content)
  }, [])

  const set_output = useCallback((value: string | null) => {
    if (!doc_ref.current) return
    const meta = doc_ref.current.getMap<string>('meta')
    meta.set('output', value || '')
  }, [])

  return {
    files,
    synced,
    output,
    provider,
    get_file_content,
    create_file,
    delete_file,
    rename_file,
    set_output,
  }
}
