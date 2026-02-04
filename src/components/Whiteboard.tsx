import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import { useTheme } from '../hooks/useTheme'
import './Whiteboard.css'

interface Point {
  x: number
  y: number
}

type Tool = 'select' | 'pen' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text'

interface BaseElement {
  id: string
  color: string
  width: number
}

interface StrokeElement extends BaseElement {
  type: 'stroke'
  points: Point[]
}

interface ShapeElement extends BaseElement {
  type: 'rect' | 'ellipse' | 'line' | 'arrow'
  start: Point
  end: Point
}

interface TextElement extends BaseElement {
  type: 'text'
  position: Point
  text: string
  fontSize: number
}

type WhiteboardElement = StrokeElement | ShapeElement | TextElement

interface WhiteboardProps {
  ymap: Y.Map<string> | null
  provider: YPartyKitProvider | null
  synced: boolean
}

const COLORS = [
  '#1a1a1a', '#6366f1', '#22d3ee', '#10b981',
  '#f59e0b', '#f43f5e', '#8b5cf6', '#f4f4f5',
]

const WIDTHS = [2, 4, 8]

export default function Whiteboard({ ymap, provider, synced }: WhiteboardProps) {
  const theme = useTheme()
  const canvas_ref = useRef<HTMLCanvasElement>(null)
  const container_ref = useRef<HTMLDivElement>(null)
  const [tool, set_tool] = useState<Tool>('pen')
  const [color, set_color] = useState('#1a1a1a') // Dark default for visibility
  const [stroke_width, set_stroke_width] = useState(4)
  const [elements, set_elements] = useState<WhiteboardElement[]>([])
  const history_ref = useRef<WhiteboardElement[][]>([])
  const redo_stack_ref = useRef<WhiteboardElement[][]>([])
  const [is_drawing, set_is_drawing] = useState(false)
  const [text_input, set_text_input] = useState<{ position: Point; value: string; editing_id?: string } | null>(null)
  const text_input_ready_ref = useRef(false)
  const [selected_ids, set_selected_ids] = useState<string[]>([])
  const [is_dragging, set_is_dragging] = useState(false)
  const [is_resizing, set_is_resizing] = useState(false)
  const [is_box_selecting, set_is_box_selecting] = useState(false)
  const [selection_box, set_selection_box] = useState<{ start: Point; end: Point } | null>(null)
  const [resize_handle, set_resize_handle] = useState<string | null>(null) // 'nw', 'ne', 'sw', 'se'
  const [hover_handle, set_hover_handle] = useState<string | null>(null)
  const drag_offset_ref = useRef<Point>({ x: 0, y: 0 })
  const drag_start_pos_ref = useRef<Point>({ x: 0, y: 0 }) // Position of first selected element when drag starts
  const resize_start_ref = useRef<{ bounds: { x: number; y: number; w: number; h: number }; point: Point; elements: WhiteboardElement[] } | null>(null)

  // Zoom and pan state
  const [scale, set_scale] = useState(1)
  const [offset, set_offset] = useState<Point>({ x: 0, y: 0 })
  const [is_panning, set_is_panning] = useState(false)
  const [show_zoom, set_show_zoom] = useState(false)
  const pan_start_ref = useRef<Point>({ x: 0, y: 0 })
  const space_pressed_ref = useRef(false)
  const zoom_timeout_ref = useRef<number | null>(null)

  const current_element_ref = useRef<WhiteboardElement | null>(null)
  const start_point_ref = useRef<Point | null>(null)
  const is_syncing_ref = useRef(false)

  // Remote cursors
  const [remote_cursors, set_remote_cursors] = useState<Map<number, { x: number; y: number; color: string; name: string }>>(new Map())

  const bg_color = theme === 'dark' ? '#0a0a0f' : '#f8f6f1'

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvas_ref.current
      const container = container_ref.current
      if (!canvas || !container) return

      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        redraw(ctx)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [elements, theme])

  // Sync from Yjs
  useEffect(() => {
    if (!ymap || !synced) return

    const sync_from_yjs = () => {
      if (is_syncing_ref.current) return
      const data = ymap.get('elements')
      if (data) {
        try {
          set_elements(JSON.parse(data))
        } catch {}
      }
    }

    sync_from_yjs()
    ymap.observe(sync_from_yjs)
    return () => ymap.unobserve(sync_from_yjs)
  }, [ymap, synced])

  // Remote cursors
  useEffect(() => {
    if (!provider) return
    const awareness = provider.awareness

    const update = () => {
      const states = awareness.getStates()
      const cursors = new Map<number, { x: number; y: number; color: string; name: string }>()
      states.forEach((state, id) => {
        if (id === awareness.clientID) return
        if (state.wb_cursor && state.user) {
          cursors.set(id, { ...state.wb_cursor, color: state.user.color || '#6366f1', name: state.user.name || 'User' })
        }
      })
      set_remote_cursors(cursors)
    }

    awareness.on('change', update)
    return () => awareness.off('change', update)
  }, [provider])

  const sync_to_yjs = useCallback((new_elements: WhiteboardElement[]) => {
    if (!ymap || !synced) return
    is_syncing_ref.current = true
    ymap.set('elements', JSON.stringify(new_elements))
    is_syncing_ref.current = false
  }, [ymap, synced])

  const redraw = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas
    const dpr = window.devicePixelRatio || 1

    // Clear with background
    ctx.fillStyle = bg_color
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    // Draw dot grid for spatial reference
    const grid_size = 40
    const dot_color = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
    const canvas_w = canvas.width / dpr
    const canvas_h = canvas.height / dpr

    // Calculate visible grid range in canvas coordinates
    const start_x = Math.floor(-offset.x / scale / grid_size) * grid_size
    const start_y = Math.floor(-offset.y / scale / grid_size) * grid_size
    const end_x = Math.ceil((canvas_w - offset.x) / scale / grid_size) * grid_size
    const end_y = Math.ceil((canvas_h - offset.y) / scale / grid_size) * grid_size

    ctx.fillStyle = dot_color
    for (let x = start_x; x <= end_x; x += grid_size) {
      for (let y = start_y; y <= end_y; y += grid_size) {
        const screen_x = x * scale + offset.x
        const screen_y = y * scale + offset.y
        ctx.beginPath()
        ctx.arc(screen_x, screen_y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw origin marker (subtle crosshair at 0,0)
    const origin_screen_x = offset.x
    const origin_screen_y = offset.y
    if (origin_screen_x >= -20 && origin_screen_x <= canvas_w + 20 &&
        origin_screen_y >= -20 && origin_screen_y <= canvas_h + 20) {
      ctx.strokeStyle = theme === 'dark' ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(origin_screen_x - 10, origin_screen_y)
      ctx.lineTo(origin_screen_x + 10, origin_screen_y)
      ctx.moveTo(origin_screen_x, origin_screen_y - 10)
      ctx.lineTo(origin_screen_x, origin_screen_y + 10)
      ctx.stroke()
    }

    // Apply zoom and pan transform
    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    const draw_element = (el: WhiteboardElement) => {
      ctx.strokeStyle = el.color
      ctx.fillStyle = el.color
      ctx.lineWidth = el.width / scale // Keep stroke width consistent regardless of zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const is_selected = selected_ids.includes(el.id)

      if (el.type === 'stroke') {
        if (el.points.length < 2) return
        ctx.beginPath()
        ctx.moveTo(el.points[0].x, el.points[0].y)
        el.points.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.stroke()
        // Selection indicator for stroke
        if (is_selected) {
          const min_x = Math.min(...el.points.map(p => p.x)) - 8
          const max_x = Math.max(...el.points.map(p => p.x)) + 8
          const min_y = Math.min(...el.points.map(p => p.y)) - 8
          const max_y = Math.max(...el.points.map(p => p.y)) + 8
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 3])
          ctx.strokeRect(min_x, min_y, max_x - min_x, max_y - min_y)
          ctx.setLineDash([])
        }
      } else if (el.type === 'rect') {
        ctx.strokeRect(el.start.x, el.start.y, el.end.x - el.start.x, el.end.y - el.start.y)
        // Selection indicator
        if (is_selected) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 3])
          const pad = 6
          ctx.strokeRect(
            Math.min(el.start.x, el.end.x) - pad,
            Math.min(el.start.y, el.end.y) - pad,
            Math.abs(el.end.x - el.start.x) + pad * 2,
            Math.abs(el.end.y - el.start.y) + pad * 2
          )
          ctx.setLineDash([])
        }
      } else if (el.type === 'ellipse') {
        const cx = (el.start.x + el.end.x) / 2
        const cy = (el.start.y + el.end.y) / 2
        const rx = Math.abs(el.end.x - el.start.x) / 2
        const ry = Math.abs(el.end.y - el.start.y) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        // Selection indicator
        if (is_selected) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 3])
          const pad = 6
          ctx.strokeRect(
            Math.min(el.start.x, el.end.x) - pad,
            Math.min(el.start.y, el.end.y) - pad,
            Math.abs(el.end.x - el.start.x) + pad * 2,
            Math.abs(el.end.y - el.start.y) + pad * 2
          )
          ctx.setLineDash([])
        }
      } else if (el.type === 'line' || el.type === 'arrow') {
        ctx.beginPath()
        ctx.moveTo(el.start.x, el.start.y)
        ctx.lineTo(el.end.x, el.end.y)
        ctx.stroke()
        if (el.type === 'arrow') {
          const angle = Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x)
          const len = 12
          ctx.beginPath()
          ctx.moveTo(el.end.x, el.end.y)
          ctx.lineTo(el.end.x - len * Math.cos(angle - Math.PI / 6), el.end.y - len * Math.sin(angle - Math.PI / 6))
          ctx.moveTo(el.end.x, el.end.y)
          ctx.lineTo(el.end.x - len * Math.cos(angle + Math.PI / 6), el.end.y - len * Math.sin(angle + Math.PI / 6))
          ctx.stroke()
        }
        // Selection indicator for line/arrow
        if (is_selected) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 3])
          const pad = 6
          ctx.strokeRect(
            Math.min(el.start.x, el.end.x) - pad,
            Math.min(el.start.y, el.end.y) - pad,
            Math.abs(el.end.x - el.start.x) + pad * 2,
            Math.abs(el.end.y - el.start.y) + pad * 2
          )
          ctx.setLineDash([])
        }
      } else if (el.type === 'text') {
        // Skip rendering if this text is being edited
        if (text_input?.editing_id === el.id) return

        ctx.font = `500 ${el.fontSize}px system-ui, -apple-system, sans-serif`
        const metrics = ctx.measureText(el.text)
        const padding = 6
        const box_x = el.position.x - padding
        const box_y = el.position.y - el.fontSize - padding + 4
        const box_w = metrics.width + padding * 2
        const box_h = el.fontSize + padding * 2

        // Selection indicator only when selected (subtle underline)
        if (is_selected) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(el.position.x, el.position.y + 4)
          ctx.lineTo(el.position.x + metrics.width, el.position.y + 4)
          ctx.stroke()
        }

        // Draw text directly - no background
        ctx.fillStyle = el.color
        ctx.fillText(el.text, el.position.x, el.position.y)
      }
    }

    elements.forEach(draw_element)
    if (current_element_ref.current) draw_element(current_element_ref.current)

    // Draw selection bounding box with resize handles
    if (selected_ids.length > 0) {
      const selected_elements = elements.filter(el => selected_ids.includes(el.id))
      if (selected_elements.length > 0) {
        let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity
        selected_elements.forEach(el => {
          if (el.type === 'stroke') {
            el.points.forEach(p => {
              min_x = Math.min(min_x, p.x)
              min_y = Math.min(min_y, p.y)
              max_x = Math.max(max_x, p.x)
              max_y = Math.max(max_y, p.y)
            })
          } else if (el.type === 'text') {
            const w = el.text.length * el.fontSize * 0.6
            min_x = Math.min(min_x, el.position.x)
            min_y = Math.min(min_y, el.position.y - el.fontSize)
            max_x = Math.max(max_x, el.position.x + w)
            max_y = Math.max(max_y, el.position.y)
          } else {
            min_x = Math.min(min_x, el.start.x, el.end.x)
            min_y = Math.min(min_y, el.start.y, el.end.y)
            max_x = Math.max(max_x, el.start.x, el.end.x)
            max_y = Math.max(max_y, el.start.y, el.end.y)
          }
        })

        const pad = 8
        const bx = min_x - pad
        const by = min_y - pad
        const bw = max_x - min_x + pad * 2
        const bh = max_y - min_y + pad * 2

        // Bounding box
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 1.5 / scale
        ctx.setLineDash([5 / scale, 5 / scale])
        ctx.strokeRect(bx, by, bw, bh)
        ctx.setLineDash([])

        // Resize handles (corners)
        const handle_size = 8 / scale
        const handles = [
          { x: bx, y: by, cursor: 'nw' },
          { x: bx + bw, y: by, cursor: 'ne' },
          { x: bx, y: by + bh, cursor: 'sw' },
          { x: bx + bw, y: by + bh, cursor: 'se' },
        ]
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 2 / scale
        handles.forEach(h => {
          ctx.beginPath()
          ctx.rect(h.x - handle_size / 2, h.y - handle_size / 2, handle_size, handle_size)
          ctx.fill()
          ctx.stroke()
        })
      }
    }

    // Draw selection box (marquee)
    if (selection_box) {
      const x = Math.min(selection_box.start.x, selection_box.end.x)
      const y = Math.min(selection_box.start.y, selection_box.end.y)
      const w = Math.abs(selection_box.end.x - selection_box.start.x)
      const h = Math.abs(selection_box.end.y - selection_box.start.y)

      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 1 / scale
      ctx.setLineDash([4 / scale, 4 / scale])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }

    ctx.restore() // Restore transform
  }, [elements, bg_color, selected_ids, theme, text_input, scale, offset, selection_box])

  useEffect(() => {
    const ctx = canvas_ref.current?.getContext('2d')
    if (ctx) redraw(ctx)
  }, [redraw])

  // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
  const screen_to_canvas = useCallback((screen_x: number, screen_y: number): Point => {
    return {
      x: (screen_x - offset.x) / scale,
      y: (screen_y - offset.y) / scale,
    }
  }, [offset, scale])

  // Convert canvas coordinates to screen coordinates
  const canvas_to_screen = useCallback((canvas_x: number, canvas_y: number): Point => {
    return {
      x: canvas_x * scale + offset.x,
      y: canvas_y * scale + offset.y,
    }
  }, [offset, scale])

  const get_point = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvas_ref.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const client_x = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
    const client_y = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY
    const screen_x = client_x - rect.left
    const screen_y = client_y - rect.top
    return screen_to_canvas(screen_x, screen_y)
  }

  const get_screen_point = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvas_ref.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const client_x = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
    const client_y = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY
    return { x: client_x - rect.left, y: client_y - rect.top }
  }

  const find_element_at = (point: Point): WhiteboardElement | null => {
    // Find element near point (for eraser)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]
      if (el.type === 'stroke') {
        for (const p of el.points) {
          if (Math.hypot(p.x - point.x, p.y - point.y) < 10) return el
        }
      } else if (el.type === 'rect' || el.type === 'ellipse') {
        const min_x = Math.min(el.start.x, el.end.x) - 10
        const max_x = Math.max(el.start.x, el.end.x) + 10
        const min_y = Math.min(el.start.y, el.end.y) - 10
        const max_y = Math.max(el.start.y, el.end.y) + 10
        if (point.x >= min_x && point.x <= max_x && point.y >= min_y && point.y <= max_y) return el
      } else if (el.type === 'line' || el.type === 'arrow') {
        const dist = point_to_line_distance(point, el.start, el.end)
        if (dist < 10) return el
      } else if (el.type === 'text') {
        // Estimate text bounding box
        const estimated_width = el.text.length * (el.fontSize * 0.6)
        const padding = 10
        const box_x = el.position.x - padding
        const box_y = el.position.y - el.fontSize - padding + 6
        const box_w = estimated_width + padding * 2
        const box_h = el.fontSize + padding * 2
        if (point.x >= box_x && point.x <= box_x + box_w && point.y >= box_y && point.y <= box_y + box_h) return el
      }
    }
    return null
  }

  const point_to_line_distance = (p: Point, a: Point, b: Point): number => {
    const len_sq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (len_sq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len_sq))
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    return Math.hypot(p.x - proj.x, p.y - proj.y)
  }

  const erased_ids_ref = useRef<Set<string>>(new Set())

  const get_element_position = (el: WhiteboardElement): Point => {
    if (el.type === 'stroke') {
      return el.points[0] || { x: 0, y: 0 }
    } else if (el.type === 'text') {
      return el.position
    } else {
      return el.start
    }
  }

  const move_element = (el: WhiteboardElement, delta: Point): WhiteboardElement => {
    if (el.type === 'stroke') {
      return { ...el, points: el.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y })) }
    } else if (el.type === 'text') {
      return { ...el, position: { x: el.position.x + delta.x, y: el.position.y + delta.y } }
    } else {
      return { ...el, start: { x: el.start.x + delta.x, y: el.start.y + delta.y }, end: { x: el.end.x + delta.x, y: el.end.y + delta.y } }
    }
  }

  const get_element_bounds = (el: WhiteboardElement): { x: number; y: number; w: number; h: number } => {
    if (el.type === 'stroke') {
      const xs = el.points.map(p => p.x)
      const ys = el.points.map(p => p.y)
      const min_x = Math.min(...xs)
      const min_y = Math.min(...ys)
      return { x: min_x, y: min_y, w: Math.max(...xs) - min_x, h: Math.max(...ys) - min_y }
    } else if (el.type === 'text') {
      const w = el.text.length * el.fontSize * 0.6
      return { x: el.position.x, y: el.position.y - el.fontSize, w, h: el.fontSize }
    } else {
      const min_x = Math.min(el.start.x, el.end.x)
      const min_y = Math.min(el.start.y, el.end.y)
      return { x: min_x, y: min_y, w: Math.abs(el.end.x - el.start.x), h: Math.abs(el.end.y - el.start.y) }
    }
  }

  const get_selection_bounds = useCallback((): { x: number; y: number; w: number; h: number } | null => {
    if (selected_ids.length === 0) return null
    const selected_elements = elements.filter(el => selected_ids.includes(el.id))
    if (selected_elements.length === 0) return null

    let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity
    selected_elements.forEach(el => {
      const b = get_element_bounds(el)
      min_x = Math.min(min_x, b.x)
      min_y = Math.min(min_y, b.y)
      max_x = Math.max(max_x, b.x + b.w)
      max_y = Math.max(max_y, b.y + b.h)
    })
    return { x: min_x, y: min_y, w: max_x - min_x, h: max_y - min_y }
  }, [selected_ids, elements])

  // Fit view to show all content
  const fit_to_content = useCallback(() => {
    if (elements.length === 0) {
      // No content, reset to origin
      set_scale(1)
      set_offset({ x: 0, y: 0 })
      return
    }

    // Calculate bounding box of all elements
    let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity

    elements.forEach(el => {
      if (el.type === 'stroke') {
        el.points.forEach(p => {
          min_x = Math.min(min_x, p.x)
          min_y = Math.min(min_y, p.y)
          max_x = Math.max(max_x, p.x)
          max_y = Math.max(max_y, p.y)
        })
      } else if (el.type === 'text') {
        const w = el.text.length * el.fontSize * 0.6
        min_x = Math.min(min_x, el.position.x)
        min_y = Math.min(min_y, el.position.y - el.fontSize)
        max_x = Math.max(max_x, el.position.x + w)
        max_y = Math.max(max_y, el.position.y)
      } else {
        min_x = Math.min(min_x, el.start.x, el.end.x)
        min_y = Math.min(min_y, el.start.y, el.end.y)
        max_x = Math.max(max_x, el.start.x, el.end.x)
        max_y = Math.max(max_y, el.start.y, el.end.y)
      }
    })

    const container = container_ref.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const padding = 60

    const content_w = max_x - min_x
    const content_h = max_y - min_y
    const available_w = rect.width - padding * 2
    const available_h = rect.height - padding * 2

    const new_scale = Math.min(1, available_w / content_w, available_h / content_h)
    const center_x = (min_x + max_x) / 2
    const center_y = (min_y + max_y) / 2

    set_scale(new_scale)
    set_offset({
      x: rect.width / 2 - center_x * new_scale,
      y: rect.height / 2 - center_y * new_scale,
    })
  }, [elements])

  // Check if point is on a resize handle, returns handle name or null
  const get_resize_handle_at = useCallback((point: Point): string | null => {
    const bounds = get_selection_bounds()
    if (!bounds) return null

    const pad = 8
    const handle_size = 12 // Slightly larger hit area
    const bx = bounds.x - pad
    const by = bounds.y - pad
    const bw = bounds.w + pad * 2
    const bh = bounds.h + pad * 2

    const handles = [
      { x: bx, y: by, name: 'nw' },
      { x: bx + bw, y: by, name: 'ne' },
      { x: bx, y: by + bh, name: 'sw' },
      { x: bx + bw, y: by + bh, name: 'se' },
    ]

    for (const h of handles) {
      if (Math.abs(point.x - h.x) < handle_size && Math.abs(point.y - h.y) < handle_size) {
        return h.name
      }
    }
    return null
  }, [get_selection_bounds])

  // Scale selected elements to new bounds (using original positions)
  const scale_elements_to_bounds = useCallback((new_bounds: { x: number; y: number; w: number; h: number }) => {
    const start_data = resize_start_ref.current
    if (!start_data || start_data.bounds.w === 0 || start_data.bounds.h === 0) return

    const old_bounds = start_data.bounds
    const original_elements = start_data.elements

    const scale_x = new_bounds.w / old_bounds.w
    const scale_y = new_bounds.h / old_bounds.h

    // Create a map of original elements by id for quick lookup
    const original_map = new Map(original_elements.map(el => [el.id, el]))

    const new_elements = elements.map(el => {
      const original = original_map.get(el.id)
      if (!original) return el // Not a selected element

      if (original.type === 'stroke') {
        return {
          ...el,
          points: (original as StrokeElement).points.map(p => ({
            x: new_bounds.x + (p.x - old_bounds.x) * scale_x,
            y: new_bounds.y + (p.y - old_bounds.y) * scale_y,
          })),
        }
      } else if (original.type === 'text') {
        const orig = original as TextElement
        return {
          ...el,
          position: {
            x: new_bounds.x + (orig.position.x - old_bounds.x) * scale_x,
            y: new_bounds.y + (orig.position.y - old_bounds.y) * scale_y,
          },
          fontSize: orig.fontSize * Math.min(scale_x, scale_y),
        }
      } else {
        const orig = original as ShapeElement
        return {
          ...el,
          start: {
            x: new_bounds.x + (orig.start.x - old_bounds.x) * scale_x,
            y: new_bounds.y + (orig.start.y - old_bounds.y) * scale_y,
          },
          end: {
            x: new_bounds.x + (orig.end.x - old_bounds.x) * scale_x,
            y: new_bounds.y + (orig.end.y - old_bounds.y) * scale_y,
          },
        }
      }
    })

    set_elements(new_elements)
  }, [elements])

  const handle_double_click = (e: React.MouseEvent) => {
    const point = get_point(e)
    const el = find_element_at(point)
    if (el && el.type === 'text') {
      // Edit existing text
      text_input_ready_ref.current = false
      set_text_input({ position: el.position, value: el.text, editing_id: el.id })
      set_color(el.color)
      setTimeout(() => { text_input_ready_ref.current = true }, 100)
    } else if (!el) {
      // Double-click on empty space: fit to content
      fit_to_content()
    }
  }

  const handle_pointer_down = (e: React.MouseEvent | React.TouchEvent) => {
    const point = get_point(e)
    const shift_held = 'shiftKey' in e && e.shiftKey

    if (tool === 'select') {
      // Check for resize handle first
      const handle = get_resize_handle_at(point)
      if (handle && selected_ids.length > 0) {
        save_history() // Save before resize
        set_is_resizing(true)
        set_resize_handle(handle)
        const bounds = get_selection_bounds()
        if (bounds) {
          // Store original elements for resize calculation
          const original_elements = elements.filter(el => selected_ids.includes(el.id)).map(el => ({ ...el }))
          resize_start_ref.current = { bounds, point, elements: original_elements }
        }
        return
      }

      const el = find_element_at(point)

      // Check if clicking inside current selection bounds (for dragging the group)
      const selection_bounds = get_selection_bounds()
      const inside_selection = selection_bounds &&
        point.x >= selection_bounds.x - 8 && point.x <= selection_bounds.x + selection_bounds.w + 8 &&
        point.y >= selection_bounds.y - 8 && point.y <= selection_bounds.y + selection_bounds.h + 8

      if (el) {
        if (shift_held) {
          // Shift-click: toggle selection
          if (selected_ids.includes(el.id)) {
            set_selected_ids(selected_ids.filter(id => id !== el.id))
          } else {
            set_selected_ids([...selected_ids, el.id])
          }
        } else {
          // Regular click: select single (or start drag if already selected)
          let current_selection = selected_ids
          if (!selected_ids.includes(el.id)) {
            current_selection = [el.id]
            set_selected_ids(current_selection)
          }
          save_history() // Save before drag
          set_is_dragging(true)
          // Use first selected element as reference for consistent drag calculation
          const first_selected = elements.find(e => current_selection.includes(e.id))
          if (first_selected) {
            const pos = get_element_position(first_selected)
            drag_offset_ref.current = { x: point.x - pos.x, y: point.y - pos.y }
            drag_start_pos_ref.current = pos
          }
        }
      } else if (inside_selection && selected_ids.length > 0) {
        // Click inside selection bounds: drag the group
        save_history()
        set_is_dragging(true)
        const first_selected = elements.find(e => selected_ids.includes(e.id))
        if (first_selected) {
          const pos = get_element_position(first_selected)
          drag_offset_ref.current = { x: point.x - pos.x, y: point.y - pos.y }
          drag_start_pos_ref.current = pos
        }
      } else {
        // Click on empty space: start box selection
        set_selected_ids([])
        set_is_box_selecting(true)
        set_selection_box({ start: point, end: point })
      }
      return
    }

    // Deselect when using other tools
    set_selected_ids([])

    if (tool === 'eraser') {
      set_is_drawing(true)
      erased_ids_ref.current = new Set()
      const el = find_element_at(point)
      if (el) {
        save_history() // Save history once at start of eraser stroke
        erased_ids_ref.current.add(el.id)
        const new_elements = elements.filter(x => x.id !== el.id)
        set_elements(new_elements)
        sync_to_yjs(new_elements)
      }
      return
    }

    if (tool === 'text') {
      if (text_input) return
      // Check if clicking on existing text to edit it
      const existing = find_element_at(point)
      if (existing && existing.type === 'text') {
        text_input_ready_ref.current = false
        set_text_input({ position: existing.position, value: existing.text, editing_id: existing.id })
        set_color(existing.color)
        setTimeout(() => { text_input_ready_ref.current = true }, 100)
        return
      }
      text_input_ready_ref.current = false
      set_text_input({ position: point, value: '' })
      setTimeout(() => { text_input_ready_ref.current = true }, 100)
      return
    }

    set_is_drawing(true)
    start_point_ref.current = point
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    if (tool === 'pen') {
      current_element_ref.current = { id, type: 'stroke', points: [point], color, width: stroke_width }
    } else {
      current_element_ref.current = { id, type: tool as 'rect' | 'ellipse' | 'line' | 'arrow', start: point, end: point, color, width: stroke_width }
    }
  }

  const handle_pointer_move = (e: React.MouseEvent | React.TouchEvent) => {
    const point = get_point(e)
    provider?.awareness.setLocalStateField('wb_cursor', point)

    // Track hover over resize handles
    if (tool === 'select' && !is_resizing && !is_dragging) {
      const handle = get_resize_handle_at(point)
      set_hover_handle(handle)
    } else if (hover_handle && !is_resizing) {
      set_hover_handle(null)
    }

    // Handle resizing
    if (is_resizing && resize_handle && resize_start_ref.current) {
      const start = resize_start_ref.current
      const old_bounds = start.bounds
      let new_bounds = { ...old_bounds }

      // Calculate new bounds based on which handle is being dragged
      if (resize_handle.includes('w')) {
        new_bounds.w = old_bounds.w + (old_bounds.x - point.x)
        new_bounds.x = point.x
      }
      if (resize_handle.includes('e')) {
        new_bounds.w = point.x - old_bounds.x
      }
      if (resize_handle.includes('n')) {
        new_bounds.h = old_bounds.h + (old_bounds.y - point.y)
        new_bounds.y = point.y
      }
      if (resize_handle.includes('s')) {
        new_bounds.h = point.y - old_bounds.y
      }

      // Ensure minimum size
      if (new_bounds.w < 10) new_bounds.w = 10
      if (new_bounds.h < 10) new_bounds.h = 10

      scale_elements_to_bounds(new_bounds)
      return
    }

    // Handle box selection
    if (is_box_selecting && selection_box) {
      set_selection_box({ ...selection_box, end: point })
      return
    }

    // Handle dragging selected elements
    if (is_dragging && selected_ids.length > 0) {
      // Use the first selected element as reference for calculating delta
      const first_selected = elements.find(el => selected_ids.includes(el.id))
      if (first_selected) {
        const pos = get_element_position(first_selected)
        const new_pos = { x: point.x - drag_offset_ref.current.x, y: point.y - drag_offset_ref.current.y }
        const delta = { x: new_pos.x - pos.x, y: new_pos.y - pos.y }
        // Move all selected elements by the same delta
        const new_elements = elements.map(el =>
          selected_ids.includes(el.id) ? move_element(el, delta) : el
        )
        set_elements(new_elements)
      }
      return
    }

    if (!is_drawing) return

    // Eraser: delete elements as we swipe over them
    if (tool === 'eraser') {
      const el = find_element_at(point)
      if (el && !erased_ids_ref.current.has(el.id)) {
        erased_ids_ref.current.add(el.id)
        const new_elements = elements.filter(x => x.id !== el.id)
        set_elements(new_elements)
        sync_to_yjs(new_elements)
      }
      return
    }

    if (!current_element_ref.current) return

    if (current_element_ref.current.type === 'stroke') {
      current_element_ref.current.points.push(point)
    } else {
      (current_element_ref.current as ShapeElement).end = point
    }

    const ctx = canvas_ref.current?.getContext('2d')
    if (ctx) redraw(ctx)
  }

  const handle_pointer_up = () => {
    // Complete box selection
    if (is_box_selecting && selection_box) {
      set_is_box_selecting(false)
      // Find elements within the selection box
      const box_min_x = Math.min(selection_box.start.x, selection_box.end.x)
      const box_max_x = Math.max(selection_box.start.x, selection_box.end.x)
      const box_min_y = Math.min(selection_box.start.y, selection_box.end.y)
      const box_max_y = Math.max(selection_box.start.y, selection_box.end.y)

      const selected = elements.filter(el => {
        const bounds = get_element_bounds(el)
        // Check if element intersects with selection box
        return !(bounds.x + bounds.w < box_min_x ||
                 bounds.x > box_max_x ||
                 bounds.y + bounds.h < box_min_y ||
                 bounds.y > box_max_y)
      }).map(el => el.id)

      set_selected_ids(selected)
      set_selection_box(null)
      return
    }

    // Complete resize operation
    if (is_resizing) {
      set_is_resizing(false)
      set_resize_handle(null)
      resize_start_ref.current = null
      sync_to_yjs(elements)
      return
    }

    // Complete drag operation
    if (is_dragging) {
      set_is_dragging(false)
      sync_to_yjs(elements) // Sync the moved element
      return
    }

    if (tool === 'eraser') {
      set_is_drawing(false)
      erased_ids_ref.current = new Set()
      return
    }

    if (!is_drawing || !current_element_ref.current) return
    set_is_drawing(false)

    save_history()
    const new_elements = [...elements, current_element_ref.current]
    set_elements(new_elements)
    sync_to_yjs(new_elements)
    current_element_ref.current = null
  }

  const handle_text_submit = () => {
    if (!text_input) {
      return
    }

    // If empty text and editing, delete the element
    if (!text_input.value.trim()) {
      if (text_input.editing_id) {
        save_history()
        const new_elements = elements.filter(el => el.id !== text_input.editing_id)
        set_elements(new_elements)
        sync_to_yjs(new_elements)
      }
      set_text_input(null)
      return
    }

    // Editing existing text
    if (text_input.editing_id) {
      save_history()
      const new_elements = elements.map(el => {
        if (el.id === text_input.editing_id && el.type === 'text') {
          return { ...el, text: text_input.value, color }
        }
        return el
      })
      set_elements(new_elements)
      sync_to_yjs(new_elements)
      set_text_input(null)
      return
    }

    // Creating new text
    save_history()
    const el: TextElement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'text',
      position: text_input.position,
      text: text_input.value,
      color,
      width: stroke_width,
      fontSize: 24,
    }

    const new_elements = [...elements, el]
    set_elements(new_elements)
    sync_to_yjs(new_elements)
    set_text_input(null)
  }

  // Save current state to history before making changes
  const save_history = useCallback(() => {
    history_ref.current.push([...elements])
    // Limit history to 50 states
    if (history_ref.current.length > 50) {
      history_ref.current.shift()
    }
    // Clear redo stack when new action is performed
    redo_stack_ref.current = []
  }, [elements])

  const undo = useCallback(() => {
    if (history_ref.current.length === 0) return
    // Save current state to redo stack
    redo_stack_ref.current.push([...elements])
    // Restore previous state
    const previous = history_ref.current.pop()!
    set_elements(previous)
    sync_to_yjs(previous)
  }, [elements, sync_to_yjs])

  const redo = useCallback(() => {
    if (redo_stack_ref.current.length === 0) return
    // Save current state to history
    history_ref.current.push([...elements])
    // Restore redo state
    const next = redo_stack_ref.current.pop()!
    set_elements(next)
    sync_to_yjs(next)
  }, [elements, sync_to_yjs])

  const clear = useCallback(() => {
    save_history()
    set_elements([])
    sync_to_yjs([])
  }, [sync_to_yjs, save_history])

  const delete_selected = useCallback(() => {
    if (selected_ids.length === 0) return
    save_history()
    const new_elements = elements.filter(el => !selected_ids.includes(el.id))
    set_elements(new_elements)
    sync_to_yjs(new_elements)
    set_selected_ids([])
  }, [selected_ids, elements, sync_to_yjs, save_history])

  // Keyboard shortcuts
  useEffect(() => {
    const handle_keydown = (e: KeyboardEvent) => {
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z' && !text_input) {
        e.preventDefault()
        redo()
        return
      }
      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !text_input) {
        e.preventDefault()
        undo()
        return
      }
      // Delete selected: Delete, Backspace, or Cmd+Delete/Cmd+Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected_ids.length > 0 && !text_input) {
        e.preventDefault()
        delete_selected()
      }
      // Deselect
      if (e.key === 'Escape') {
        set_selected_ids([])
      }
      // Select all: Cmd+A
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !text_input) {
        e.preventDefault()
        set_selected_ids(elements.map(el => el.id))
      }
    }
    window.addEventListener('keydown', handle_keydown)
    return () => window.removeEventListener('keydown', handle_keydown)
  }, [selected_ids, delete_selected, text_input, undo, redo, elements])

  // Zoom and pan handlers
  const reset_view = useCallback(() => {
    set_scale(1)
    set_offset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const container = container_ref.current
    if (!container) return

    // Wheel: pan normally, zoom with Ctrl/Cmd (pinch gesture)
    const handle_wheel = (e: WheelEvent) => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        // Zoom (pinch gesture on trackpad)
        const rect = container.getBoundingClientRect()
        const mouse_x = e.clientX - rect.left
        const mouse_y = e.clientY - rect.top

        const zoom_intensity = 0.01
        const delta = -e.deltaY * zoom_intensity
        const new_scale = Math.min(Math.max(0.1, scale * (1 + delta)), 5)

        // Zoom toward cursor position
        const scale_ratio = new_scale / scale
        const new_offset_x = mouse_x - (mouse_x - offset.x) * scale_ratio
        const new_offset_y = mouse_y - (mouse_y - offset.y) * scale_ratio

        set_scale(new_scale)
        set_offset({ x: new_offset_x, y: new_offset_y })

        // Show zoom indicator briefly
        set_show_zoom(true)
        if (zoom_timeout_ref.current) clearTimeout(zoom_timeout_ref.current)
        zoom_timeout_ref.current = window.setTimeout(() => set_show_zoom(false), 1000)
      } else {
        // Pan (regular scroll / two-finger drag)
        set_offset({
          x: offset.x - e.deltaX,
          y: offset.y - e.deltaY,
        })
      }
    }

    container.addEventListener('wheel', handle_wheel, { passive: false })
    return () => container.removeEventListener('wheel', handle_wheel)
  }, [scale, offset])

  // Space key for pan mode
  useEffect(() => {
    const handle_keydown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !text_input) {
        e.preventDefault()
        space_pressed_ref.current = true
      }
      if (e.code === 'Home') {
        reset_view()
      }
    }
    const handle_keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space_pressed_ref.current = false
        set_is_panning(false)
      }
    }
    window.addEventListener('keydown', handle_keydown)
    window.addEventListener('keyup', handle_keyup)
    return () => {
      window.removeEventListener('keydown', handle_keydown)
      window.removeEventListener('keyup', handle_keyup)
    }
  }, [text_input, reset_view])

  // Handle panning with middle mouse or space+drag
  const handle_pan_start = (e: React.MouseEvent) => {
    if (e.button === 1 || space_pressed_ref.current) { // Middle mouse or space held
      e.preventDefault()
      set_is_panning(true)
      pan_start_ref.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    }
  }

  const handle_pan_move = (e: React.MouseEvent) => {
    if (is_panning) {
      set_offset({
        x: e.clientX - pan_start_ref.current.x,
        y: e.clientY - pan_start_ref.current.y,
      })
    }
  }

  const handle_pan_end = () => {
    set_is_panning(false)
  }

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3zM13 13l6 6', label: 'Select' },
    { id: 'pen', icon: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586', label: 'Pen' },
    { id: 'rect', icon: 'M3 3h18v18H3z', label: 'Rectangle' },
    { id: 'ellipse', icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', label: 'Ellipse' },
    { id: 'line', icon: 'M5 19L19 5', label: 'Line' },
    { id: 'arrow', icon: 'M5 19L19 5M19 5v10M19 5H9', label: 'Arrow' },
    { id: 'text', icon: 'M4 7V4h16v3M9 20h6M12 4v16', label: 'Text' },
    { id: 'eraser', icon: 'M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 19', label: 'Eraser' },
  ]

  return (
    <div className="whiteboard-container" ref={container_ref}>
      <div className="whiteboard-toolbar">
        <div className="toolbar-group">
          {tools.map(t => (
            <button
              key={t.id}
              className={`wb-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => set_tool(t.id)}
              title={t.label}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={t.icon} />
              </svg>
            </button>
          ))}
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => set_color(c)}
            />
          ))}
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          {WIDTHS.map(w => (
            <button
              key={w}
              className={`wb-btn width-btn ${stroke_width === w ? 'active' : ''}`}
              onClick={() => set_stroke_width(w)}
            >
              <span style={{ width: w * 2 + 4, height: w * 2 + 4 }} />
            </button>
          ))}
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="wb-btn" onClick={undo} title="Undo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
            </svg>
          </button>
          <button className="wb-btn" onClick={clear} title="Clear">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <canvas
        ref={canvas_ref}
        className={`whiteboard-canvas ${tool === 'select' ? 'select-mode' : ''} ${is_panning || space_pressed_ref.current ? 'panning' : ''} ${hover_handle ? `resize-${hover_handle}` : ''}`}
        onMouseDown={(e) => { handle_pan_start(e); if (!is_panning && !space_pressed_ref.current) handle_pointer_down(e) }}
        onMouseMove={(e) => { handle_pan_move(e); if (!is_panning) handle_pointer_move(e) }}
        onMouseUp={(e) => { handle_pan_end(); handle_pointer_up() }}
        onMouseLeave={() => { handle_pan_end(); handle_pointer_up() }}
        onDoubleClick={handle_double_click}
        onTouchStart={handle_pointer_down}
        onTouchMove={handle_pointer_move}
        onTouchEnd={handle_pointer_up}
      />

      {/* Zoom indicator */}
      <div className={`zoom-indicator ${show_zoom ? 'visible' : ''}`}>
        {Math.round(scale * 100)}%
      </div>

      {text_input && (() => {
        const screen_pos = canvas_to_screen(text_input.position.x, text_input.position.y)
        return (
        <input
          className="text-input"
          style={{
            left: screen_pos.x,
            top: screen_pos.y - 24 * scale, // Offset to align with text baseline
            color: color,
            fontSize: 24 * scale,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          autoFocus
          value={text_input.value}
          onChange={e => set_text_input({ ...text_input, value: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handle_text_submit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              set_text_input(null)
            }
          }}
          onBlur={() => {
            // Only handle blur if the input has been ready for interaction
            if (text_input_ready_ref.current) {
              handle_text_submit()
            }
          }}
          placeholder="Type..."
        />
        )
      })()}

      {Array.from(remote_cursors.entries()).map(([id, c]) => {
        const screen_pos = canvas_to_screen(c.x, c.y)
        return (
          <div key={id} className="wb-cursor" style={{ left: screen_pos.x, top: screen_pos.y, '--c': c.color } as React.CSSProperties}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.65 3.15l14.85 6.5c.8.35.8 1.5 0 1.85l-5.5 2.4-2.4 5.5c-.35.8-1.5.8-1.85 0L5.65 4.55c-.35-.8.3-1.75 1.1-1.4z"/></svg>
            <span>{c.name}</span>
          </div>
        )
      })}
    </div>
  )
}
