import type * as Party from 'partykit/server'
import { onConnect } from 'y-partykit'

export default class YjsServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    return onConnect(conn, this.room, {
      persist: { mode: 'snapshot' },
    })
  }

  async onRequest(req: Party.Request) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const api_key = this.room.env.RESEND_API_KEY as string | undefined
    if (!api_key) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    try {
      const body = await req.json() as {
        email: string
        room_id: string
        notes: string
        code: string
        language: string
        candidate_name: string
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Interview Pad <onboarding@resend.dev>',
          to: [body.email],
          subject: body.candidate_name
            ? `Interview Recap — ${body.candidate_name}`
            : `Interview Recap — Session (${body.room_id})`,
          html: build_email_html(body),
        }),
      })

      if (!res.ok) {
        const err_data = await res.json() as { message?: string }
        return new Response(JSON.stringify({ error: err_data.message || 'Failed to send email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
  }
}

function build_email_html(data: {
  notes: string
  code: string
  language: string
  candidate_name: string
  room_id: string
}): string {
  const escaped_notes = escape_html(data.notes || '')
  const escaped_code = escape_html(data.code || '')
  const candidate = escape_html(data.candidate_name || 'Unknown candidate')
  const lang = escape_html(data.language)
  const date_str = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const time_str = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const note_lines = data.notes ? data.notes.split('\n').filter(l => l.trim()).length : 0
  const code_lines = data.code ? data.code.split('\n').filter(l => l.trim()).length : 0

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#111118;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:640px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6366f1;text-transform:uppercase;margin-bottom:16px;">Interview Pad</div>
          <h1 style="color:#f4f4f5;font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;">Session Recap</h1>
          <p style="color:#71717a;font-size:13px;margin:0;">${date_str} at ${time_str}</p>
        </td>
      </tr>
    </table>

    <!-- Candidate card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#18181f;border:1px solid #27272a;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="40" valign="top">
                <div style="width:36px;height:36px;border-radius:50%;background:#6366f1;color:#fff;font-size:15px;font-weight:700;line-height:36px;text-align:center;">${candidate.charAt(0).toUpperCase()}</div>
              </td>
              <td style="padding-left:14px;" valign="middle">
                <div style="color:#f4f4f5;font-size:15px;font-weight:600;margin:0 0 2px;">${candidate}</div>
                <div style="color:#71717a;font-size:12px;">Room ${escape_html(data.room_id)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Summary stats -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="50%" style="padding-right:6px;">
          <div style="background:#18181f;border:1px solid #27272a;border-radius:10px;padding:16px 18px;">
            <div style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Notes</div>
            <div style="color:#f4f4f5;font-size:20px;font-weight:700;">${note_lines}<span style="color:#71717a;font-size:12px;font-weight:500;margin-left:4px;">${note_lines === 1 ? 'line' : 'lines'}</span></div>
          </div>
        </td>
        <td width="50%" style="padding-left:6px;">
          <div style="background:#18181f;border:1px solid #27272a;border-radius:10px;padding:16px 18px;">
            <div style="color:#71717a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Solution</div>
            <div style="color:#f4f4f5;font-size:20px;font-weight:700;">${code_lines}<span style="color:#71717a;font-size:12px;font-weight:500;margin-left:4px;">${code_lines === 1 ? 'line' : 'lines'} &middot; ${lang}</span></div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Notes section -->
    <div style="margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d97706;margin-right:8px;vertical-align:middle;"></span>
            <span style="font-size:13px;font-weight:700;color:#f4f4f5;vertical-align:middle;">Your Notes</span>
          </td>
        </tr>
      </table>
      <div style="background:#18181f;border:1px solid #27272a;border-left:3px solid #d97706;border-radius:8px;padding:18px 20px;">
        ${escaped_notes
          ? `<pre style="color:#d4d4d8;font-family:'SF Mono','JetBrains Mono','Fira Code',monospace;font-size:13px;line-height:1.7;margin:0;white-space:pre-wrap;word-wrap:break-word;">${escaped_notes}</pre>`
          : `<p style="color:#52525b;font-size:13px;font-style:italic;margin:0;">No notes recorded.</p>`
        }
      </div>
    </div>

    <!-- Code section -->
    <div style="margin-bottom:36px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6366f1;margin-right:8px;vertical-align:middle;"></span>
            <span style="font-size:13px;font-weight:700;color:#f4f4f5;vertical-align:middle;">Solution</span>
            <span style="display:inline-block;background:#6366f1;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle;text-transform:uppercase;letter-spacing:0.03em;">${lang}</span>
          </td>
        </tr>
      </table>
      <div style="background:#0d0d14;border:1px solid #27272a;border-radius:8px;padding:18px 20px;overflow-x:auto;">
        ${escaped_code
          ? `<pre style="color:#d4d4d8;font-family:'SF Mono','JetBrains Mono','Fira Code',monospace;font-size:13px;line-height:1.6;margin:0;white-space:pre-wrap;word-wrap:break-word;">${escaped_code}</pre>`
          : `<p style="color:#52525b;font-size:13px;font-style:italic;margin:0;">No solution code.</p>`
        }
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #27272a;padding-top:20px;text-align:center;">
      <p style="color:#3f3f46;font-size:11px;margin:0;">
        Sent from <span style="color:#52525b;font-weight:600;">Interview Pad</span>
      </p>
    </div>
  </div>
</body>
</html>`
}

function escape_html(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
