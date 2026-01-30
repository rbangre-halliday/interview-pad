import type { VercelRequest, VercelResponse } from '@vercel/node'

interface EmailRequest {
  to: string
  code: string
  language: string
  room_id: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const api_key = process.env.RESEND_API_KEY
  if (!api_key) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
  }

  const { to, code, language, room_id } = req.body as EmailRequest

  if (!to || !code) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Interview Pad <onboarding@resend.dev>',
      to,
      subject: `Interview Code Submission - Room ${room_id}`,
      html: `
        <h2>Interview Code Submission</h2>
        <p><strong>Room:</strong> ${room_id}</p>
        <p><strong>Language:</strong> ${language}</p>
        <p><strong>Submitted:</strong> ${new Date().toISOString()}</p>
        <hr />
        <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: 'Menlo', 'Monaco', monospace; font-size: 13px;">${escape_html(code)}</pre>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return res.status(500).json({ error: `Failed to send email: ${error}` })
  }

  return res.status(200).json({ success: true })
}

function escape_html(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
