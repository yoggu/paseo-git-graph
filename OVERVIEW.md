# Git Graph

Shows repository history, working-tree changes and file diffs in a workspace or Explorer panel. Includes branches, remotes, tags, stashes, revision comparisons and Git actions with a command preview and confirmation.

Requires Paseo app and daemon 0.11.1 or newer and Git on the daemon's PATH. The repository picker uses registered Paseo projects and workspaces; folders are read when expanded. Syntax highlighting is bundled. Remote actions use the daemon's existing Git/SSH authentication, without interactive terminal prompts.

Repository content and metadata are displayed to connected Paseo clients. The plugin does not use a forge API or add telemetry. Network access happens through explicitly requested Git remote actions. History and working-tree views refresh while the panel is open.

Only open trusted repositories. The plugin is unsandboxed, and Git can execute hooks, filters, credential helpers and configured transports. Mutating actions require confirmation, but destructive operations can still lose work. Force-push uses force-with-lease. File previews are limited to 512 KiB, with separate handling for binary files and symlinks.

Supports light/dark themes and compact layouts. macOS is locally tested; Windows and physical mobile-device validation are not claimed. Appearance settings use a read-only storage compatibility adapter and fall back to defaults if unavailable. Search covers loaded commits. Dynamic diff tabs may need reopening after a restart, and a pull failure after checkout leaves the target branch checked out.
