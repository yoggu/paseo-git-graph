import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAppearance, parseAppearance } from '../shared/appearance.ts'
import { colorScheme, contrastingTextColor, syntaxRole } from '../shared/syntax-color.ts'
import { resolveSyntaxColors, SYNTAX_THEME_IDS } from '../shared/paseo-syntax-themes.ts'

test('appearance matches Paseo defaults and scales UI and code independently', () => {
  const defaults = buildAppearance()
  assert.equal(defaults.uiFontSize, 14)
  assert.equal(defaults.smallFontSize, 12)
  assert.equal(defaults.codeFontSize, 12)
  assert.equal(defaults.diffLineHeight, 18)
  assert.equal(defaults.rowHeight, 32)
  const custom = buildAppearance({ uiFontFamily: ' Georgia ', monoFontFamily: 'Courier New', uiBaseFontSize: 21, codeFontSize: 16, contentFontSize: 10, syntaxTheme: 'github' })
  assert.equal(custom.uiFontFamily, 'Georgia')
  assert.equal(custom.monoFontFamily, 'Courier New')
  assert.equal(custom.uiFontSize, 21)
  assert.equal(custom.smallFontSize, 18)
  assert.equal(custom.codeFontSize, 16)
  assert.equal(custom.diffLineHeight, 24)
  assert.equal(custom.rowHeight, 40)
  assert.equal(custom.syntaxTheme, 'github')
})

test('native defaults and custom settings do not assume desktop fonts', () => {
  const ios = buildAppearance(undefined, 'ios'), android = buildAppearance(undefined, 'android')
  assert.equal(ios.uiFontSize, 15)
  assert.equal(ios.uiFontFamily, 'system-ui')
  assert.equal(ios.monoFontFamily, 'ui-monospace')
  assert.equal(android.uiFontFamily, 'normal')
  assert.equal(android.monoFontFamily, 'monospace')
  assert.equal(buildAppearance({ uiFontFamily: 'Roboto' }, 'android').uiFontFamily, 'Roboto')
})

test('malformed or unavailable settings fall back and sizes use Paseo bounds', () => {
  assert.deepEqual(parseAppearance('{bad json', 'web'), buildAppearance())
  assert.deepEqual(buildAppearance([]), buildAppearance())
  const high = buildAppearance({ uiBaseFontSize: 999, codeFontSize: 999, syntaxTheme: 'unknown' })
  assert.equal(high.uiFontSize, 21)
  assert.equal(high.codeFontSize, 22)
  assert.equal(high.syntaxTheme, 'one')
  const low = buildAppearance({ uiBaseFontSize: -2, codeFontSize: 1 })
  assert.equal(low.uiFontSize, 10)
  assert.equal(low.codeFontSize, 9)
  assert.equal(buildAppearance({ uiBaseFontSize: NaN, codeFontSize: Infinity }).uiFontSize, 14)
  for (const font of ['x;y', 'x\ny', '<style>', 'x'.repeat(201)]) {
    assert.equal(buildAppearance({ uiFontFamily: font }).uiFontFamily, buildAppearance().uiFontFamily)
  }
})

test('applied UI font wins over stored settings; legacy font-size field remains readable', () => {
  const result = parseAppearance(JSON.stringify({ uiFontFamily: 'Old', uiFontSize: 17 }), 'web', 'Current')
  assert.equal(result.uiFontFamily, 'Current')
  assert.equal(result.uiFontSize, 17)
})

test('syntax theme palettes match Paseo and all roles are complete', () => {
  for (const id of SYNTAX_THEME_IDS) for (const scheme of ['light', 'dark']) {
    const palette = resolveSyntaxColors(id, scheme)
    assert.equal(Object.keys(palette).length, 20)
    assert.ok(Object.values(palette).every(color => /^#[0-9a-f]{6}$/i.test(color)))
  }
  assert.equal(resolveSyntaxColors('github', 'light').keyword, '#cf222e')
  assert.equal(resolveSyntaxColors('github', 'dark').keyword, '#ff7b72')
  assert.equal(resolveSyntaxColors('one', 'dark').keyword, '#c678dd')
  assert.deepEqual(resolveSyntaxColors('dracula', 'light'), resolveSyntaxColors('dracula', 'dark'))
})

test('native Paseo syntax roles are preserved without highlight.js scope conversion', () => {
  for (const role of Object.keys(resolveSyntaxColors('one', 'dark'))) assert.equal(syntaxRole(role), role)
  assert.equal(syntaxRole('title.function'), null)
  assert.equal(syntaxRole('hljs-keyword'), null)
  assert.equal(syntaxRole('comment'), 'comment')
  assert.equal(syntaxRole('keyword'), 'keyword')
  assert.equal(syntaxRole(null), null)
  assert.equal(syntaxRole('unknown'), null)
})

test('colored reference icons use the highest-contrast available Paseo text color', () => {
  assert.equal(contrastingTextColor('#a7c5ff', '#eeeeee', '#141817', '#121212'), '#121212')
  assert.equal(contrastingTextColor('#2255aa', '#151515', '#ffffff'), '#ffffff')
  assert.equal(contrastingTextColor('#f2c26b', '#eeeeee', '#141817'), '#141817')
  assert.equal(contrastingTextColor('rgb(255, 255, 255)', '#fff', '#000'), '#000')
  assert.equal(contrastingTextColor('unknown', '#eeeeee', '#141817'), '#eeeeee')
})

test('syntax light/dark variant follows host colors, including RGB and tinted themes', () => {
  assert.equal(colorScheme('#fff', '#111'), 'light')
  assert.equal(colorScheme('#101010', '#dddddd'), 'dark')
  assert.equal(colorScheme('rgb(240, 240, 240)', '#333333'), 'light')
  assert.equal(colorScheme('#888888', '#111111'), 'light')
  assert.equal(colorScheme('#141817ff', '#eeeeee'), 'dark')
  assert.equal(colorScheme('transparent', '#111111'), 'light')
})
