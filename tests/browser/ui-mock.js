import React from 'react'
import { View, Text } from 'react-native'
export { FlatList, ScrollView, TextInput } from 'react-native'
const h = React.createElement
export function Icon() { return null }
export function useToast() { return { show: console.log, error: console.error } }
export const copyText = text => navigator.clipboard.writeText(text)
export function Modal({ title, open, children, onOpenChange }) {
  if (!open) return null
  return h(View, { style: { position: 'absolute', top: 40, left: 20, right: 20, bottom: 40, zIndex: 99, backgroundColor: '#232323', padding: 16 } },
    h(Text, { style: { color: '#eee', fontSize: 18 }, onPress: () => onOpenChange(false) }, title), children)
}
Modal.Content = ({ children }) => h(View, { style: { padding: 16, gap: 12, overflow: 'auto', flex: 1 } }, children)
