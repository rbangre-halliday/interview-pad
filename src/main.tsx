import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loader } from '@monaco-editor/react'
import App from './App'
import './index.css'

// Configure Monaco with custom theme
loader.init().then(monaco => {
  monaco.editor.defineTheme('interview-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' },
      { token: 'string.escape', foreground: '56b6c2' },
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'class', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'operator', foreground: '56b6c2' },
      { token: 'delimiter', foreground: 'abb2bf' },
      { token: 'identifier', foreground: 'e06c75' },
      { token: 'constant', foreground: 'd19a66' },
    ],
    colors: {
      'editor.background': '#0a0a0f',
      'editor.foreground': '#abb2bf',
      'editorLineNumber.foreground': '#4b5263',
      'editorLineNumber.activeForeground': '#737984',
      'editor.selectionBackground': '#3e4451',
      'editor.lineHighlightBackground': '#2c313a',
      'editorCursor.foreground': '#528bff',
      'editorWhitespace.foreground': '#3b4048',
    }
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
