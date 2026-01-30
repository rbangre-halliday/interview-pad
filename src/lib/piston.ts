const PISTON_API = 'https://emkc.org/api/v2/piston'

export interface ExecutionResult {
  stdout: string
  stderr: string
  compile_output: string | null
  status: { id: number; description: string }
  time: string | null
  memory: number | null
}

interface PistonResponse {
  run: {
    stdout: string
    stderr: string
    code: number
    output: string
  }
  compile?: {
    stdout: string
    stderr: string
    code: number
    output: string
  }
}

export async function executeCode(source_code: string, language: string, version: string): Promise<ExecutionResult> {
  const payload = {
    language,
    version,
    files: [{ name: 'main', content: source_code }],
  }
  console.log('Piston request:', payload)

  const response = await fetch(`${PISTON_API}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Execution failed: ${response.status}`)
  }

  const result: PistonResponse = await response.json()
  console.log('Piston response:', result)

  const has_error = result.run.code !== 0 || (result.compile && result.compile.code !== 0)
  const compile_error = result.compile?.code !== 0 ? result.compile?.stderr || result.compile?.output : null

  return {
    stdout: result.run.stdout,
    stderr: result.run.stderr,
    compile_output: compile_error || null,
    status: {
      id: has_error ? 11 : 3,
      description: has_error ? (compile_error ? 'Compilation Error' : 'Runtime Error') : 'Accepted',
    },
    time: null,
    memory: null,
  }
}
