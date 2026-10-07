import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY } from '../shared/appearance.ts'

async function loadStore(platform) {
  const dir = mkdtempSync(join(tmpdir(), 'appearance-store-'))
  try {
    const mock = join(dir, 'native.js')
    writeFileSync(mock, `export const Platform = { OS: "${platform}" }; export const NativeModules = globalThis.__appearanceNative ?? {};`)
    const result = await build({ entryPoints: [new URL('../client/appearance-store.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm',
      platform: 'node', alias: { 'react-native': mock } })
    return await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64') + '#' + Math.random())
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('client settings update live without storage writes; snapshot reads stay pure and subscriptions clean up', async () => {
  const values = new Map([[APP_SETTINGS_KEY, JSON.stringify({ uiBaseFontSize: 18 })]]), events = new Map()
  let observerCallback, disconnected = false, uiFont = ''
  globalThis.window = {
    localStorage: { getItem: key => values.get(key) ?? null },
    getComputedStyle: () => ({ getPropertyValue: () => uiFont }),
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name),
  }
  globalThis.document = { documentElement: {} }
  globalThis.MutationObserver = class {
    constructor(callback) { observerCallback = callback }
    observe() {}
    disconnect() { disconnected = true }
  }
  let off
  try {
    const store = await loadStore('web')
    assert.equal(store.appearanceSnapshot().uiFontSize, 18)
    let changed = 0
    off = store.subscribeAppearance(() => changed++)
    const old = store.appearanceSnapshot()
    assert.equal(store.appearanceSnapshot(), old)
    values.set(APP_SETTINGS_KEY, JSON.stringify({ uiBaseFontSize: 21, codeFontSize: 16 }))
    assert.equal(store.appearanceSnapshot(), old)
    await new Promise(resolve => setTimeout(resolve, 650))
    assert.equal(store.appearanceSnapshot().uiFontSize, 21)
    assert.equal(store.appearanceSnapshot().codeFontSize, 16)
    assert.equal(changed, 1)
    uiFont = 'Georgia'
    observerCallback()
    assert.equal(store.appearanceSnapshot().uiFontFamily, 'Georgia')
    assert.equal(changed, 2)
    events.get('focus')()
    assert.equal(changed, 2)
    off(); off = null
    assert.equal(disconnected, true)
    assert.equal(events.size, 0)
    values.set(APP_SETTINGS_KEY, '{}')
    await new Promise(resolve => setTimeout(resolve, 600))
    assert.equal(changed, 2)
  } finally {
    off?.()
    delete globalThis.window; delete globalThis.document; delete globalThis.MutationObserver
  }
})

test('blocked web storage falls back safely', async () => {
  globalThis.window = { localStorage: { getItem() { throw Error('blocked') } }, getComputedStyle() { throw Error('blocked') } }
  try {
    const store = await loadStore('web')
    assert.equal(store.appearanceSnapshot().uiFontSize, 14)
    assert.equal(store.appearanceSnapshot().syntaxTheme, 'one')
  } finally { delete globalThis.window }
})

test('native appearance reads the host storage, ignores late callbacks, and never writes it', async () => {
  const callbacks = []
  globalThis.__appearanceNative = { RNCAsyncStorage: { multiGet(keys, callback) {
    assert.deepEqual(keys, [APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY]); callbacks.push(callback)
  } } }
  let off
  try {
    const store = await loadStore('ios')
    assert.equal(store.appearanceSnapshot().uiFontSize, 15)
    off = store.subscribeAppearance(() => {})
    callbacks.shift()(null, [[APP_SETTINGS_KEY, JSON.stringify({ uiBaseFontSize: 19, monoFontFamily: 'Menlo' })]])
    assert.equal(store.appearanceSnapshot().uiFontSize, 19)
    assert.equal(store.appearanceSnapshot().monoFontFamily, 'Menlo')
    off(); off = store.subscribeAppearance(() => {})
    const stale = callbacks.shift()
    off(); off = store.subscribeAppearance(() => {})
    const current = callbacks.shift()
    stale(null, [[APP_SETTINGS_KEY, JSON.stringify({ uiBaseFontSize: 10 })]])
    assert.equal(store.appearanceSnapshot().uiFontSize, 19)
    current(null, [[APP_SETTINGS_KEY, null], [LEGACY_SETTINGS_KEY, JSON.stringify({ codeFontSize: 22 })]])
    assert.equal(store.appearanceSnapshot().uiFontSize, 15)
    assert.equal(store.appearanceSnapshot().codeFontSize, 22)
  } finally { off?.(); delete globalThis.__appearanceNative }
})

test('native clients without a storage module retain platform defaults', async () => {
  const store = await loadStore('android')
  const off = store.subscribeAppearance(() => {})
  try { assert.equal(store.appearanceSnapshot().uiFontFamily, 'normal') }
  finally { off() }
})
