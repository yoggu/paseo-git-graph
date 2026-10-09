# Paseo Git Graph

Git history, working-tree diffs and confirmed Git actions in a [Paseo](https://paseo.sh) workspace panel.

## Install

Requires **Paseo 0.11.1 or newer on both app and daemon**, and **Git on the daemon's PATH**. Enable plugins in **Settings → Plugins** only after reviewing the source: plugins are trusted, unsandboxed code.

```sh
paseo plugin install git:yoggu/paseo-git-graph
```

Alternatively, enter `git:yoggu/paseo-git-graph` in Settings → Plugins. Install on the daemon that owns your repositories. No npm install or compilation is needed for normal use; syntax highlighting is bundled and Paseo supplies the other runtime libraries.

Open a workspace, then choose **+ → Git Graph** or **Open Git Graph** in the Command Center (⌘K / Ctrl+K). The panel also supports Explorer tabs. Paseo's built-in Changes view is unchanged.

```sh
paseo plugin update paseo-git-graph
paseo plugin logs paseo-git-graph
paseo plugin remove paseo-git-graph
```

## Features

- Branch, remote, tag and stash history, with pagination and search over loaded commits.
- Repository picker for the current workspace and registered Paseo projects.
- Inline commit details and separate staged, unstaged and untracked changes.
- Dedicated, deduplicated diff tabs with split/unified views, syntax highlighting, wrapping and adjustable context.
- Revision comparisons, including comparisons with the working tree.
- Branch, commit, file, tag, stash and remote actions, with a command preview and confirmation before mutation.
- Light/dark themes, compact layouts and client appearance settings.

History refreshes every 10 seconds while the panel is open; working-tree and live-diff views refresh every 3 seconds. There is no automatic remote fetch. Network operations occur only through explicitly requested Git actions.

## Safety and privacy

Repository roots are resolved from Paseo workspaces/projects, not arbitrary client-supplied absolute paths. Git commands use argument arrays, not shell command strings. File previews are bounded to 512 KiB and do not follow symlink targets outside the repository. External diff drivers and textconv are disabled.

**Only open trusted repositories.** Git can still run hooks, filters, credential helpers and configured transports. Confirmation is not a sandbox. Reset, clean, checkout and other destructive actions can lose work; force-push uses `--force-with-lease`.

The plugin reads repository content and metadata for display in your connected Paseo clients. It does not use a GitHub/Bitbucket API or add telemetry. Remote actions use your existing Git/SSH credentials on the daemon. Interactive terminal prompts are disabled; configure non-interactive authentication before fetching or pushing.

See [SECURITY.md](SECURITY.md).

## Compatibility and limits

The UI uses React Native primitives for desktop/web and native clients. macOS is locally tested; mobile-device and Windows validation are not claimed.

Appearance settings are read through a compatibility adapter because Paseo's public SDK currently exposes colors, not the full appearance configuration. It reads local settings without changing them and falls back to defaults. Changes to Paseo's storage format may require an update.

Search covers loaded commits only. Large/binary diffs have limited previews. Dynamic diff tabs may need reopening after an app/plugin restart. A failed pull after a successful checkout leaves the selected branch checked out.

## Development

Use **Node.js 24+**, npm and Git:

```sh
git clone https://github.com/yoggu/paseo-git-graph.git
cd paseo-git-graph
npm ci --ignore-scripts
npm run typecheck
npm test
```

For the browser smoke test, install Playwright's Chromium or point to an existing Chrome/Chromium executable:

```sh
npx --no-install playwright-core install chromium
npm run test:browser
# Alternative: CHROME_BIN=/absolute/path/to/chrome npm run test:browser
```

The browser test uses temporary repositories and writes ignored screenshots under `tests/screenshots/`. It does not replace real-device testing.

`server/syntax-runtime.js` is checked in. Regenerate it with `npm run build:syntax` when changing the highlighter, then rerun tests. For local plugin development: `paseo plugin install "$PWD"`, followed by `paseo plugin reload paseo-git-graph`.

## License and attribution

Own code and the adapted [DSH Git Graph](https://github.com/yoggu/dsh-git-graph) code: [MIT](LICENSE). Adapted Paseo diff/highlighting code: Apache-2.0. Bundled grammar licenses and source revisions are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/](licenses/).
