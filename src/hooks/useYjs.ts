import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || '127.0.0.1:1999'

export interface SharedState {
  language_id: string
  output: string | null
}

export function useYjs(room_id: string) {
  const [ytext, set_ytext] = useState<Y.Text | null>(null)
  const [provider, set_provider] = useState<YPartyKitProvider | null>(null)
  const [synced, set_synced] = useState(false)
  const [shared_state, set_shared_state] = useState<SharedState>({ language_id: 'python3', output: null })
  const doc_ref = useRef<Y.Doc | null>(null)
  const ymap_ref = useRef<Y.Map<string> | null>(null)
  const provider_ref = useRef<YPartyKitProvider | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    doc_ref.current = doc

    const ytext_instance = doc.getText('monaco')
    set_ytext(ytext_instance)

    const ymap_instance = doc.getMap<string>('state')
    ymap_ref.current = ymap_instance

    // Listen for changes to shared state
    ymap_instance.observe(() => {
      set_shared_state({
        language_id: ymap_instance.get('language_id') || 'python3',
        output: ymap_instance.get('output') || null,
      })
    })

    const provider_instance = new YPartyKitProvider(PARTYKIT_HOST, room_id, doc)
    provider_ref.current = provider_instance
    set_provider(provider_instance)

    provider_instance.on('sync', (is_synced: boolean) => {
      console.log('Yjs synced:', is_synced)
      set_synced(is_synced)
      if (is_synced) {
        set_shared_state({
          language_id: ymap_instance.get('language_id') || 'python3',
          output: ymap_instance.get('output') || null,
        })
      }
    })

    return () => {
      provider_instance.destroy()
      doc.destroy()
    }
  }, [room_id])

  const set_language_id = useCallback((id: string) => {
    ymap_ref.current?.set('language_id', id)
  }, [])

  const set_output = useCallback((output: string | null) => {
    ymap_ref.current?.set('output', output || '')
  }, [])

  return { ytext, provider, synced, shared_state, set_language_id, set_output }
}
