# Third-party notices

## dsh-git-graph

Git backend, repository discovery, graph layout, ref grouping, action definitions and diff parser adapted from https://github.com/yoggu/dsh-git-graph, revision d33b13b6c38e2da066c25f52f611b479c7dff658.

Copyright (c) 2026 Yannick Bättig. MIT; full license in LICENSE.

## Paseo

The following files derive from https://github.com/getpaseo/paseo, revision f13bb2136cc67265c5bb8c61020caf4c2f606f75:

- `shared/paseo-diff-layout.ts`: copied from `packages/app/src/utils/diff-layout.ts`; local type imports and preservation of no-newline notes.
- `shared/paseo-diff-rendering.ts`: copied from `packages/app/src/utils/diff-rendering.ts`, without behavioral changes.
- `server/paseo-diff-highlighter.ts`: highlighting portion of `packages/server/src/server/utils/diff-highlighter.ts`; accepts explicit, bounded full-file contents without its default filesystem fallback. Hunk reconstruction, old/new token lookup and native token roles are preserved.
- `shared/paseo-syntax-types.ts`, `shared/paseo-syntax-colors.ts`, `shared/paseo-syntax-themes.ts`: copied from `packages/highlight/src/{types,colors,themes}.ts`; local import paths and attribution headers. The selected palette follows the client appearance setting and host light/dark colors.
- `client/diff-viewer.tsx`: adapted from `packages/app/src/components/diff-viewer.tsx`; plugin theme and UI imports, virtualized numbered rows, split layout, wrapping and server-provided syntax tokens. Private app hooks, Unistyles and review/canvas infrastructure are not included. Later adaptations use client appearance settings for typography and syntax palettes, theme status colors for diff tints, and variable code metrics.

Copyright (c) 2025-present Mohamed Boudra. Apache License 2.0; full upstream license in licenses/PASEO-LICENSE. Modifications are identified in the file headers.

## @getpaseo/highlight 0.11.0-beta.5

The same Lezer/CodeMirror-based highlighter used by Paseo’s built-in diff pane, installed at an exact package version and bundled with its grammars into `server/syntax-runtime.js` by `npm run build:syntax`. Package dependencies are locked in `package-lock.json`. Paseo code: Apache-2.0; see `licenses/PASEO-LICENSE` and the Astro grammar attribution in `licenses/PASEO-HIGHLIGHT-ASTRO-LICENSE`.

Bundled CodeMirror, Lezer, @marijn/find-cluster-break, crelt, style-mod and w3c-keyname packages are MIT-licensed; lezer-elixir is Apache-2.0. Their full package license texts are preserved in `licenses/PASEO-HIGHLIGHT-DEPENDENCIES`. The bundle also preserves inline legal comments. highlight.js is no longer used or distributed.

Paseo supplies the host runtime SDK, React, React Native, TanStack Query and Zod. Other development dependencies retain their own licenses in their packages.
