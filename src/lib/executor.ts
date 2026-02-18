const WANDBOX_API = 'https://wandbox.org/api'

const COMPILER_MAP: Record<string, string> = {
  'python': 'cpython-3.14.0',
  'javascript': 'nodejs-20.17.0',
  'typescript': 'typescript-5.6.2',
  'java': 'openjdk-jdk-22+36',
  'c': 'gcc-13.2.0-c',
  'c++': 'gcc-13.2.0',
}

export interface ExecutionResult {
  stdout: string
  stderr: string
  compile_output: string | null
  status: { id: number; description: string }
  time: string | null
  memory: number | null
}

interface WandboxResponse {
  program_output?: string
  program_error?: string
  compiler_output?: string
  compiler_error?: string
  compiler_message?: string
  program_message?: string
  status: string
}

export async function executeCode(source_code: string, language: string, _version: string): Promise<ExecutionResult> {
  const compiler = COMPILER_MAP[language]
  if (!compiler) {
    throw new Error(`Unsupported language: ${language}`)
  }

  const payload = {
    compiler,
    code: source_code,
    stdin: '',
  }
  console.log('Wandbox request:', payload)

  const response = await fetch(`${WANDBOX_API}/compile.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Execution failed: ${response.status}`)
  }

  const result: WandboxResponse = await response.json()
  console.log('Wandbox response:', result)

  const exit_code = parseInt(result.status || '0')
  const compile_error = result.compiler_error || null
  const has_error = exit_code !== 0 || !!compile_error

  return {
    stdout: result.program_output || '',
    stderr: result.program_error || '',
    compile_output: compile_error,
    status: {
      id: has_error ? 11 : 3,
      description: has_error ? (compile_error ? 'Compilation Error' : 'Runtime Error') : 'Accepted',
    },
    time: null,
    memory: null,
  }
}
