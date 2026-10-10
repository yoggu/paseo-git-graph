# Paseo Git Graph

Git history, working-tree diffs and confirmed Git actions in a [Paseo](https://paseo.sh) workspace panel.

## Install

Requires **Paseo 0.11.1+** on app and daemon, **Git** on the daemon's PATH, and plugins enabled in **Settings → Plugins**.

```sh
paseo plugin install git:yoggu/paseo-git-graph
```

No separate build is needed. Open **+ → Git Graph** in a workspace or **Open Git Graph** in the Command Center (⌘K / Ctrl+K).

```sh
paseo plugin update paseo-git-graph
```

## Features

- Branches, remotes, tags and stashes, with paginated history and search.
- Staged, unstaged and untracked changes; revision comparisons.
- Separate diff tabs with split/unified views and syntax highlighting.
- Git actions with command previews and confirmation.
- Repository picker, light/dark themes and compact layouts.

**Only open trusted repositories.** Plugins are unsandboxed, Git can execute hooks and helpers, and destructive actions can lose work. Remote actions use existing Git/SSH credentials; there is no automatic fetch or telemetry. Search covers loaded commits only.

## Development

Node.js 24+: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`.
For browser tests: `npx --no-install playwright-core install chromium`, then `npm run test:browser` (or set `CHROME_BIN`).
The highlighter is bundled; `npm run build:syntax` regenerates it.
Install locally with `paseo plugin install "$PWD"`; reload with `paseo plugin reload paseo-git-graph`.
React Native development tooling has known audit warnings (`npm audit`); it is not shipped with the plugin.

Paseo Git Graph is licensed under [MIT](LICENSE). Third-party code retains its original licenses, including Apache-2.0 for adapted Paseo code; see [NOTICE](NOTICE).
