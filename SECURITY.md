# Security

## Trust and data access

Paseo plugins are trusted, unsandboxed code. Git Graph reads repository content, authors, references and filesystem paths and presents them to connected Paseo clients. A diff can itself contain sensitive data; do not share screenshots or patches without reviewing them.

Git invocations use validated argument arrays and bounded output/timeouts. Repository targets are resolved through Paseo's registered roots. File previews reject traversal and symlink escapes. Writing actions are queued and show a command plan before confirmation. These safeguards do not sandbox a repository or provide authorization between different users of the same daemon.

Only open trusted repositories. Git can execute hooks, filters, credential helpers, SSH commands and configured transports. Remote URLs or Git errors may themselves contain embedded credentials if your repository is misconfigured; use SSH agents or credential helpers instead of token-bearing URLs. No forge API token is required by this plugin.

## Reporting a vulnerability

Do not post credentials, session logs, private diffs or exploit details in a public issue. Use GitHub's private vulnerability reporting if enabled, or contact the maintainer privately. Rotate any exposed credential immediately; deleting it from the latest commit does not remove it from Git history.

## Dependencies and verification

Runtime host libraries are supplied by Paseo. Keep the app and daemon updated; their dependency security is outside this repository's control.

Development installs include Paseo-compatible React Native tooling. At the latest preparation check, `npm audit` reported 20 development-dependency findings (15 high, 5 moderate), while `npm audit --omit=dev` reported zero. Compatible `npm audit fix` did not resolve these; blindly forcing a React Native major upgrade would break the host/tooling alignment. These development dependencies are not bundled into the plugin or installed for normal Git-source use. Use a trusted development checkout, `npm ci --ignore-scripts`, and review future upstream fixes.

Gitleaks scans and manual review found no credentials in the inspected Git history or working tree. A scan is not a proof of absence or a complete security audit. Git history retains author metadata; the original Git Graph README also contains an obsolete local installation path, not a credential. No history rewrite has been performed.
