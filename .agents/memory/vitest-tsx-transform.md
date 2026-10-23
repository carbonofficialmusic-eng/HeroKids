---
name: React-Testlauf von App-Fehlern unterscheiden
description: Testsuche, JSX-Transformation und React-Modulidentität bei monorepo-weiten Prüfungen.
---

Ein roter React-Testlauf ist nicht automatisch ein Browserfehler. Zuerst prüfen, ob die eigenen Tests gesammelt wurden, JSX transformiert wird und Renderer und Komponenten dieselbe React-Instanz verwenden.

**Why:** Frühere Prüfungen scheiterten vor dem Rendern an JSX-Transformation oder einem fehlenden Hook-Dispatcher, obwohl die Browser-App lief. Eine Suche vom Workspace-Root sammelte zudem Fremdtests aus dem Bun-Paketcache ein.

**How to apply:** Eigene Testverzeichnisse ausdrücklich eingrenzen und Fremd-Caches/Backups ausschließen. Nicht gestartete Dateien getrennt von fehlgeschlagenen Testfällen berichten. Nach einem React-Importfehler die Testeinrichtung korrigieren, statt UI-Assertions zu entfernen oder die App umzuschreiben.

Bei Tests über Artefaktgrenzen hinweg können externe UI-Abhängigkeiten trotz React-Alias eine andere React-Hauptversion laden.

**Why:** Ein aus dem TV importiertes Icon erzeugte React-19-Elemente für einen React-18-Test-Renderer; der Fehler „Objects are not valid as a React child“ war ein Test-Kontextproblem, kein Fehler der laufenden TV-App.

**How to apply:** Bei diesem Fehler auch die React-Auflösung externer Abhängigkeiten untersuchen. Tests auf die eigentliche Verantwortung des Bausteins begrenzen oder einen konsistenten Renderer-Kontext schaffen; keine funktionierenden Produktabhängigkeiten allein wegen eines gemischten Test-Kontexts austauschen.

Auch mit derselben Konfigurationsdatei können der Workspace-Root und das Web-Artefakt unterschiedliche Test-Runner-Versionen auflösen.

**Why:** Der Root-Runner scheiterte bei artefaktübergreifenden TSX-Tests vor der Testsammlung, während der im Web-Paket aufgelöste Runner dieselben Dateien korrekt transformierte.

**How to apply:** Für vorhandene gemeinsame Web-/TV-Tests den Runner im Web-Paket ausführen; ein separater TV-Testkontext darf nur mit expliziter JSX-Transformation und konsistenter React-Auflösung eingesetzt werden. Vor Änderungen an Produktcode die tatsächlich aufgelöste Runner-Version und Transformation prüfen.

Ein React-Alias muss auch die JSX-Runtimes abdecken; gleiche Versionsnummern garantieren keine gemeinsame Modulinstanz.

**Why:** Der Hook-Dispatcher war trotz React 18 auf beiden Seiten getrennt, weil pnpm- und Root-Installationen verschiedene Dateien auflösten. Anschließend erzeugte ein unberücksichtigter Entwicklungs-JSX-Runtime wieder Elemente einer anderen Hauptversion.

**How to apply:** Komponenten, JSX-Runtime, Entwicklungs-JSX-Runtime und externen Renderer auf dieselbe physische React-Installation ausrichten. Bei neuerem Vite außerdem dessen tatsächlichen JSX-Transformer konfigurieren; Einstellungen für einen älteren Transformer können ignoriert werden.

Root-Aliase erreichen nicht immer extern geladene Abhängigkeiten mit ihrer eigenen React-Hauptversion.

**Why:** Extern geladene Query-Provider und Icon-Bibliotheken können trotz konsistenter App-Aliase einen anderen Hook-Dispatcher oder inkompatible React-Elemente verwenden.

**How to apply:** Bei isolierten UI-Tests mit bereits gemockten Datenhooks auch unbenutzte Provider und rein dekorative Icons mocken; bei Integrationstests die Auflösung der externen Abhängigkeiten vereinheitlichen. Dies ist kein Anlass, Produktabhängigkeiten auszutauschen.

CSS-Regressionstests müssen sicherstellen, dass sie den echten Stylesheet-Text prüfen, nicht einen vom Test-Runner ersetzten CSS-Import.

**Why:** Im bestehenden Test-Kontext lieferte auch ein CSS-Rohimport nicht den erwarteten Text. Außerdem wird eine statische Asset-URL über `new URL(..., import.meta.url)` von Vite als Browser-Ressource umgeschrieben und ist dann kein gültiger Node-Dateipfad.

**How to apply:** Stylesheet-Text für solche Tests mit Node-Dateipfadauflösung aus dem Testverzeichnis lesen. Die relevanten Regeln in ihrer ursprünglichen Reihenfolge prüfen, damit CSS-Prioritätsfehler tatsächlich erkannt werden.

Gezielte Vitest-Aufrufe direkt über `pnpm --filter @workspace/little-champs exec vitest run --config vitest.config.ts <Testdatei>` starten.

**Why:** Ein zusätzliches `--` beim Aufruf des vorhandenen Test-Scripts führte dazu, dass der gewünschte Dateifilter nicht griff und auch unabhängige TV-Suites liefen.

**How to apply:** Für fokussierte Prüfungen den direkten Runner-Aufruf verwenden; einen ungeplant breiten Lauf nicht als Beleg für Fehler im geänderten Baustein behandeln.