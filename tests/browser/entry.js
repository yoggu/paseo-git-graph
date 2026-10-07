import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Pressable, Text, View } from 'react-native'
import contribute from '../../index.client'
const h = React.createElement
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const dark = { foreground: '#eee', foregroundMuted: '#aaa', surface0: '#141817', surface1: '#222927', surface2: '#303936', border: '#3e4945', accent: '#a7c5ff', accentForeground: '#121212', statusSuccess: '#77d9a7', statusWarning: '#f2c26b', statusDanger: '#ff9b9b' }
const light = { foreground: '#151515', foregroundMuted: '#555', surface0: '#fff', surface1: '#f2f2f2', surface2: '#e4e4e4', border: '#bbb', accent: '#2255aa', accentForeground: '#fff', statusSuccess: '#126633', statusWarning: '#865500', statusDanger: '#bb2233' }
const panels = new Map(), tabs = new Set(['git-graph']), listeners = new Set()
let active = 'git-graph', version = 0
function notify() { version++; for (const listener of listeners) listener() }
contribute({
  addWorkspacePanel(panel) { panels.set(panel.id, panel); return () => { panels.delete(panel.id); notify() } },
  addCommandCenterItem() { return () => {} },
  openPanel(id, options) {
    if (options.workspaceId !== 'fixture') throw new Error('Wrong workspace for diff tab')
    tabs.add(id); active = id; notify()
  },
})
function App() {
  const [width, setWidth] = useState(window.innerWidth)
  const [colors, setColors] = useState(dark)
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => version)
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  window.setGraphTheme = name => setColors(name === 'light' ? light : dark)
  const panel = panels.get(active)
  return h(QueryClientProvider, { client: queryClient },
    h(View, { style: { flexDirection: 'row', backgroundColor: colors.surface2, minHeight: 32 } },
      [...tabs].map(id => h(Pressable, { key: id, accessibilityRole: 'button', accessibilityLabel: `Tab ${panels.get(id).title}`,
        onPress: () => { active = id; notify() }, style: { padding: 7 } }, h(Text, { style: { color: colors.foreground } }, panels.get(id).title)))),
    h(panel.Component, { key: active, context: 'workspace', workspaceId: 'fixture', theme: { colors }, layout: { compact: width < 650, platform: 'web' }, host: {} }))
}
createRoot(document.getElementById('root')).render(h(App))
