import { useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || '127.0.0.1:1999'

export interface FileInfo {
  name: string
  type: 'code' | 'markdown' | 'text' | 'whiteboard'
  language?: string
}

export interface User {
  id: number
  name: string
  color: string
  role: 'interviewer' | 'candidate'
}

const ROLE_COLORS: Record<string, string> = {
  interviewer: '#6366f1', // indigo
  candidate: '#10b981',   // emerald
}

const FALLBACK_COLORS = [
  '#f43f5e', // rose
  '#22d3ee', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
]

function get_color_for_role(role: string): string {
  return ROLE_COLORS[role] || FALLBACK_COLORS[Math.floor(Math.random() * FALLBACK_COLORS.length)]
}

const DEFAULT_QUESTION = `# Interview Problem

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

function get_file_type(filename: string): 'code' | 'markdown' | 'text' | 'whiteboard' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'wb') return 'whiteboard'
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

export function useFileSystem(room_id: string, user_name: string, user_role: 'interviewer' | 'candidate') {
  const [files, set_files] = useState<FileInfo[]>([])
  const [synced, set_synced] = useState(false)
  const [output, set_output_state] = useState<string | null>(null)
  const [provider, set_provider] = useState<YPartyKitProvider | null>(null)
  const [users, set_users] = useState<User[]>([])
  const [current_user, set_current_user] = useState<User | null>(null)
  const [, force_update] = useState(0)

  const doc_ref = useRef<Y.Doc | null>(null)
  const provider_ref = useRef<YPartyKitProvider | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    doc_ref.current = doc

    const provider_instance = new YPartyKitProvider(PARTYKIT_HOST, room_id, doc)
    provider_ref.current = provider_instance
    set_provider(provider_instance)

    // Set up awareness for user presence
    const awareness = provider_instance.awareness
    const user_color = get_color_for_role(user_role)

    // Set local user state with actual name and role
    awareness.setLocalStateField('user', {
      name: user_name,
      role: user_role,
      color: user_color,
    })

    // Track connected users
    const update_users = () => {
      const states = awareness.getStates()
      const connected_users: User[] = []

      states.forEach((state, client_id) => {
        if (state.user) {
          connected_users.push({
            id: client_id,
            name: state.user.name || 'Anonymous',
            color: state.user.color || get_color_for_role(state.user.role || 'candidate'),
            role: state.user.role || 'candidate',
          })
        }
      })

      // Sort: interviewers first, then by client ID
      connected_users.sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === 'interviewer' ? -1 : 1
        }
        return a.id - b.id
      })

      set_users(connected_users)

      // Update current user
      const me = connected_users.find(u => u.id === awareness.clientID)
      if (me) {
        set_current_user(me)
      }
    }

    awareness.on('change', update_users)
    update_users()

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
        console.log('File list from meta:', file_list_json)

        // Parse and check if we need to initialize
        let needs_init = false
        if (!file_list_json) {
          needs_init = true
        } else {
          try {
            const parsed = JSON.parse(file_list_json)
            needs_init = !Array.isArray(parsed) || parsed.length === 0
          } catch {
            needs_init = true
          }
        }

        if (needs_init) {
          console.log('Initializing default files...')
          // Initialize default files
          const default_files = ['question.md', 'solution.py', 'whiteboard.wb']
          meta.set('files', JSON.stringify(default_files))

          // Initialize file contents
          const question_text = doc.getText('file:question.md')
          if (question_text.length === 0) {
            question_text.insert(0, DEFAULT_QUESTION)
          }

          const solution_text = doc.getText('file:solution.py')
          if (solution_text.length === 0) {
            solution_text.insert(0, DEFAULT_SOLUTION)
          }

          // Initialize whiteboard with empty elements
          const whiteboard_map = doc.getMap<string>('whiteboard:whiteboard.wb')
          if (!whiteboard_map.get('elements')) {
            whiteboard_map.set('elements', '[]')
          }
        }
        update_state()
      }
    })

    return () => {
      awareness.off('change', update_users)
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

  const get_whiteboard_data = useCallback((filename: string): Y.Map<string> | null => {
    if (!doc_ref.current) return null
    return doc_ref.current.getMap<string>(`whiteboard:${filename}`)
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
    users,
    current_user,
    get_file_content,
    get_whiteboard_data,
    create_file,
    delete_file,
    rename_file,
    set_output,
  }
}
