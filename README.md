# paseo-git-graph

Paseo-Port von [yoggu/dsh-git-graph](https://github.com/yoggu/dsh-git-graph), basierend auf Revision `d33b13b6c38e2da066c25f52f611b479c7dff658`.

## Installation

Benötigt Paseo **0.11.0-beta.5 oder neuer**, auf Host und Client. Plugins müssen unter **Settings → Plugins** aktiviert sein.

```sh
paseo plugin install /Users/yannickbattig/Projects/paseo-git-graph
```

Im Workspace **+ → Git Graph** oder **⌘K → Open Git Graph** öffnen. Das Panel ist für Workspace- und Explorer-Tabs registriert. Die eingebaute Changes-Ansicht bleibt unverändert.

## Funktionen

- Kompakter Graph mit dem ursprünglichen Lane-Layout und Paseo-Theme-Farben; keine Beschränkung auf Ahead-Commits.
- Alle Branches, Remote-Referenzen, Tags und Stashes; alternativ eine einzelne Referenz oder HEAD.
- History in Seiten à 120 Commits; **Load older commits** lädt weiter.
- Suche über bereits geladene Commits, Autoren, Hashes und Referenzen. Nicht passende Zeilen werden gedimmt, damit die Topologie erhalten bleibt.
- Zusammengefasste Local-/Remote-Labels wie im Original. Branch-/Remote-/Tag-/Stash-Labels übernehmen exakt die Farbe ihres Graph-Knotens: farbiges Icon-Feld und Branch-Text, mit kontrastreichem Icon aus Paseo-Theme-Farben. Der aktuell ausgecheckte Commit erhält zusätzlich einen Punkt direkt links vom Branch-Label bzw. Commit-Text in seiner Lane-Farbe (wie VS Code Git Graph). HEAD erhält einen farbigen Rahmen und fett gesetzten Branch-/Commit-Text. Referenzaktionen und Commit-Auswahl sind getrennte Bedienelemente.
- Repository-Picker für registrierte Paseo-Projekte und den aktuellen Workspace. Unterordner werden nur beim Aufklappen gelesen.
- Inline-Accordion direkt unter dem ausgewählten Commit, mit Metadaten und Dateiliste. Ein zweiter Klick klappt es wieder zu.
- Uncommitted Changes als echte erste Graph-Zeile wie in VS Code Git Graph: hohler grauer Knoten, Verbindung zum tatsächlichen HEAD und fett gesetzter Dateizähler. Keine separate Statusleiste, keine SHA/Autoren- oder Staged-Spalte; bei sauberem Working Tree wird die Zeile ausgeblendet. Teilweise gestagte Dateien zählen nur einmal.
- Working Tree mit separaten staged, unstaged und untracked Einträgen im eigenen Inline-Accordion. Auch durch das offene Accordion läuft die Verbindung zu HEAD weiter.
- Klick auf eine Datei öffnet einen eigenen Diff-Tab; derselbe Vergleich wird nicht doppelt geöffnet. Andere Dateien, Revisionen und staged/unstaged Vergleiche bleiben getrennt.
- Eigener Diff-Viewer, adaptiert aus Paseo: Auto-/Unified-/Split-Layout, Zeilennummern, Diff-Hintergründe, Syntax-Highlighting, Zeilenumbruch, einstellbarer Kontext, Refresh und Copy Patch.
- Untracked Textdateien werden als neue Dateien angezeigt; binäre Dateien erhalten einen Hinweis. Untracked Vorschauen sind auf 512 KiB begrenzt und folgen keinen Datei-Symlinks.
- Offene Diff-Tabs behalten ihren Repository-/Revisions-Snapshot, auch wenn im Graph ein anderes Repository ausgewählt wird.
- Vergleich über **⇔** oder Ctrl/Cmd-Klick: erst A, dann B. A lässt sich auch mit dem Working Tree vergleichen.
- Branch-, Tag-, Stash-, Commit- und Dateiaktionen über **⋯** bzw. Long-Press. Schreiben erfolgt erst nach einem serverseitig geplanten, angezeigten und bestätigten Git-Befehl.
- Remote-Branch-Menü nach dem [Checkout-/Pull-Ablauf von VS Code Git Graph](https://github.com/mhutchie/vscode-git-graph/blob/d7f43f429a9e024e896bac9fc65fdc530935c812/web/main.ts#L1620): **Checkout Branch…** verwendet einen vorhandenen lokalen Branch oder legt einen Tracking-Branch an und zieht anschließend Änderungen vom ausgewählten Remote. Standardmäßig Fast-forward-only, kein Überschreiben lokaler Commits. **Pull into current branch** benennt den tatsächlich aktualisierten Branch; **Fetch into local branch** erscheint nur für einen vorhandenen, nicht aktuellen lokalen Branch. Remote-Teile zusammengefasster Labels (z. B. `main · origin`) öffnen separat das Remote-Menü. Scheitert der Pull nach erfolgreichem Checkout, bleibt der Zielbranch ausgecheckt; die Anzeige wird auch bei Fehlern aktualisiert.
- Originale Argumentvalidierung, Repository-Grenzen, Schreib-Queue und Schutz bei laufenden Git-Operationen und in anderen Worktrees ausgecheckten Branches.

Das Plugin benötigt keine GitHub-/Bitbucket-API und führt keinen automatischen Fetch aus. **Fetch** liest ausdrücklich die konfigurierten Remotes.

## Paseo Appearance-Settings

Graph, Dateilisten, Dialoge und Diff-Tabs übernehmen die UI-/Mono-Schrift, Interface-/Code-Größe und Syntax-Palette des jeweiligen Paseo-Clients aus **Settings → Appearance**. Die UI-Hierarchie skaliert wie Paseos Font-Ramp; Code-Größe und Diff-Zeilenhöhe bleiben unabhängig davon. Größere UI-Schrift vergrößert auch Graph-Zeilen und Accordions. Chat-/Content-Größe wird bewusst nicht auf die Git-Oberfläche angewendet.

Flächen, Text, Controls, Statusfarben und Graph-Lanes verwenden die aktiven `theme.colors`, einschließlich Light/Dark und Plugin-Themes. Die Syntax-Paletten stammen aus Paseo; Mono-Flächen sind von Paseos globaler Web-UI-Schriftregel ausgenommen.

Das SDK von Paseo 0.11 stellt Plugins nur Farb-Tokens bereit. Ein rein lesender Kompatibilitätsadapter liest deshalb `@paseo:app-settings` (Legacy: `@paseo:settings`) im Client: auf Desktop/Web aus Local Storage und der angewendeten UI-Font-Variable, auf Native über den vorhandenen AsyncStorage-Bridge. Während ein Panel offen ist, werden Änderungen spätestens beim nächsten 500-ms-Poll übernommen; Web-Font-/Storage-/Focus-Ereignisse aktualisieren zusätzlich sofort. Es werden keine Paseo-Settings geschrieben, keine privaten App-Stores importiert und keine Daemon-Einstellungen als Client-Settings verwendet. Fehlt der Storage-Bridge oder sind Werte ungültig, gelten sichere Paseo-/Plattform-Defaults. Diese Anbindung muss bei Änderungen am Speicherformat geprüft werden, bis Paseo eine öffentliche Appearance-API anbietet.

## Anpassungen gegenüber DSH

Die Oberfläche ist für Paseos React-Native-Laufzeit adaptiert; DOM, SVG, Cordis, HTTP-Routen und SSE werden nicht mitgeladen. Kurven des ursprünglichen Graphen werden als native Segmente gezeichnet und laufen durch das offene Accordion weiter. Das Accordion ist bei Standard-UI-Schrift 220 px hoch, auf kompakten Clients 280 px, und skaliert mit der gewählten Interface-Größe; die Drag-Resizer des Originals sind noch nicht portiert.

Der Diff-Viewer ist ein eigener Plugin-Tab, nicht Paseos eingebauter Diff-Tab. Er übernimmt Paseos Nummerierung, Replacement-Pairing, Token-Kompaktierung und visuelle Behandlung von Diff-Zeilen, ohne private App-Stores, Unistyles, Canvas-/Skia- oder Review-Infrastruktur zu importieren. Syntax-Highlighting erfolgt serverseitig mit **`@getpaseo/highlight@0.11.0-beta.5` (Lezer/CodeMirror)**, derselben Bibliothek wie Paseos eingebautes Diff-Pane. Die adaptierte native Diff-Tokenisierung erhält vollständigen alten/neuen Datei-Kontext aus den passenden Revisionen, dem Index oder dem Working Tree; insbesondere wird für staged Vergleiche nicht die Arbeitskopie als neue Seite verwendet. Sind Inhalte nicht verfügbar, greift Paseos Hunk-Rekonstruktion mit echten Zeilennummern. Native Syntax-Rollen gehen unverändert an den Viewer, ohne highlight.js-Klassen oder angenäherte Rollen-Zuordnung. Unterstützte Sprachen entsprechen der Paseo-Bibliothek; andere Dateien bleiben Klartext.

Zusätzliche Datei-/Blob-Lesevorgänge sind auf 512 KiB begrenzt, lesen keine Symlink-Ziele außerhalb des Repositories und verwenden keine Textconv-/externen Diff-Treiber. Überlange Zeilen und sehr große oder extrem dünn besetzte Diffs fallen sicher auf Klartext zurück. Ändert sich ein Datei-/Index-Inhalt zwischen Patch-Erstellung und Tokenisierung, darf er den Patch-Text nicht ersetzen. `server/syntax-runtime.js` enthält die Bibliothek und Grammatiken als eingechecktes, selbstständiges Bundle; `npm run build:syntax` reproduziert es.

Diff-Tabs werden bei Bedarf für die laufende Plugin-Installation registriert. Normale Tab-Wechsel erhalten das offene Accordion und die Repository-Auswahl. Nach einem Plugin-/App-Neustart muss ein gespeicherter dynamischer Diff-Tab durch erneutes Öffnen der Datei aus dem Graph registriert werden.

Automatische Aktualisierung erfolgt nur bei geöffnetem Panel über TanStack Query: Working Tree und live Diffs alle 3 Sekunden, History/Operationsstatus alle 10 Sekunden. Nach bestätigten Aktionen wird sofort aktualisiert. Historische Vergleiche behalten ihre konkreten Commit-IDs; nur Vergleiche mit Working Tree oder Index werden gepollt.

## Entwicklung

```sh
npm ci --ignore-scripts
npm run build:syntax
npm run typecheck
npm test
npm run test:browser
paseo plugin reload paseo-git-graph
```

Die Syntax-Tests vergleichen die Tokens für alle Paseo-Grammatiken direkt mit `@getpaseo/highlight` und prüfen mehrzeiligen Kontext sowie staged/unstaged/historische Quellen. Der Browser-Smoke-Test verwendet eine temporäre Git-Fixture, React Native Web und Mock-Host-UI. Er prüft live geänderte Appearance-Settings, unabhängige UI-/Mono-Schriften und Größen, Syntax-Paletten, Theme-Lanes und farbgleiche Referenzlabels/Icon-Felder einschließlich nicht-primärem HEAD, große Schrift und skalierte Accordion-Geometrie sowie Pagination, Referenzfilter, die VS-Code-artige Working-Tree-Zeile einschließlich Verbindung zu einem älteren HEAD und Ausblenden bei sauberem Working Tree, Accordion-Geometrie, separate und deduplizierte Diff-Tabs, erhaltene Graph-Auswahl, Compare, staged/unstaged/untracked und Live-Diffs, sichere Syntax-Tokens, Split/Wrap/Kontext, Dark/Light, kompakte Darstellung, Fehler/Retry, Repository-Snapshots und eine bestätigte Branch-Aktion. Screenshots landen in `tests/screenshots/`. Standardmäßig wird Google Chrome auf macOS verwendet; `CHROME_BIN` überschreibt den Pfad. Die Tests ersetzen keine Prüfung auf einem echten iOS-/Android-Gerät.

## Sicherheit und Lizenz

Plugins sind vertrauenswürdiger, nicht sandboxierter Code. Git kann Hooks, Filter, Credential-Helper und konfigurierte Transporte ausführen. Nur vertrauenswürdige Repositories öffnen. Destruktive Aktionen können Änderungen verlieren; Force-Push verwendet `--force-with-lease`.

Eigener Code und DSH-Code: MIT, Copyright Yannick Bättig; siehe [LICENSE](LICENSE). Git-Backend, Discovery, Graph-Layout, Ref-Gruppierung, Aktionsdefinitionen und Diff-Parser stammen aus dem oben genannten DSH-Repository.

Adaptierte Paseo-Diff-Komponenten, native Diff-Tokenisierung, kopierte Layout-/Rendering-Helfer und Syntax-Paletten: Apache-2.0, Copyright Mohamed Boudra. Herkunft, Revisionen und weitere Lizenztexte stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) und `licenses/`.
