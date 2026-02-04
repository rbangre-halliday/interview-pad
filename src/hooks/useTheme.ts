import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme(): Theme {
  const [theme, set_theme] = useState<Theme>(() => {
    return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark'
  })

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const new_theme = document.documentElement.getAttribute('data-theme') as Theme
          set_theme(new_theme || 'dark')
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return theme
}
