import { ExecutionResult } from '../lib/piston'
import './OutputPanel.css'

interface OutputPanelProps {
  result: ExecutionResult | null
  is_running: boolean
}

export default function OutputPanel({ result, is_running }: OutputPanelProps) {
  const render_content = () => {
    if (is_running) {
      return (
        <div className="output-loading">
          <div className="output-loading-spinner" />
          <span>Executing code...</span>
        </div>
      )
    }

    if (!result) {
      return <div className="output-message">Run your code to see output</div>
    }

    const has_error = result.status.id !== 3

    let output_text = ''
    if (result.compile_output) {
      output_text = result.compile_output
    } else {
      if (result.stdout) output_text += result.stdout
      if (result.stderr) output_text += result.stderr
    }
    if (!output_text) output_text = 'No output'

    return (
      <>
        <div className={`output-status ${has_error ? 'error' : 'success'}`}>
          {result.status.description}
          {result.time && <span className="output-time"> ({result.time}s)</span>}
        </div>
        <pre className="output-content">{output_text}</pre>
      </>
    )
  }

  return (
    <div className="output-panel">
      <div className="output-header">Output</div>
      <div className="output-body">{render_content()}</div>
    </div>
  )
}
