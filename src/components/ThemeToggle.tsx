import { useState, useEffect } from 'react'
import './ThemeToggle.css'

type Theme = 'dark' | 'light'

function get_stored_theme(): Theme {
  const stored = localStorage.getItem('interview-pad-theme')
  if (stored === 'light' || stored === 'dark') return stored
  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export default function ThemeToggle() {
  const [theme, set_theme] = useState<Theme>(get_stored_theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('interview-pad-theme', theme)
  }, [theme])

  const toggle = () => {
    set_theme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      className={`theme-toggle ${theme}`}
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className="toggle-track">
        <span className="toggle-thumb">
          <span className="icon sun">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </span>
          <span className="icon moon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </span>
        </span>
      </span>
    </button>
  )
}
