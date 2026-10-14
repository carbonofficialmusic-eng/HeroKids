---
name: GitHub-Connector für Branch-Sync
description: Sicherer API-Fallback, wenn die lokale Git-Remote trotz aktiver Replit-GitHub-Verbindung nicht authentifiziert ist.
---

**Rule:** Eine aktive Replit-GitHub-Connector-Verbindung authentifiziert nicht automatisch `git push` gegen eine lokale HTTPS-Remote. Wenn ein vollständiger Branch-Stand über die GitHub-Git-API übertragen werden muss, erst die Live-Ref gegen den erwarteten Ausgangs-Commit prüfen und dann einen nicht erzwungenen Ref-Update verwenden.

**Why:** Der lokale Push kann wegen fehlender HTTPS-Anmeldung scheitern, obwohl der Connector `repo`-Schreibrechte hat. Ein vollständiger rekursiver Tree-Request kann über den Connector mit HTTP 502 scheitern; ein kleiner Tree mit `base_tree` und nur geänderten oder gelöschten Einträgen funktioniert.

**How to apply:** Remote-Ref und Parent-SHA vor jedem Schreibvorgang vergleichen. Neue Blobs hochladen, einen kompakten Tree auf dem vorhandenen Remote-Tree aufbauen, einen Commit mit dem geprüften Parent erzeugen und die Branch-Ref nur mit `force: false` aktualisieren. Connector-Fehler 502/503/504 pro Blob mit begrenztem Backoff wiederholen; sie können vor dem Ref-Update transient auftreten. Abschließend Remote-Tree-SHA und lokalen Tree-SHA vergleichen.

## Freigegebener Release-Umfang

Der Nutzer hat ausdrücklich freigegeben, Backups, Test-ZIPs, generierte native Ausgabe und unbenötigte Uploads aus dem GitHub-Release-Stand auszunehmen; lokale Dateien bleiben erhalten.

**Why:** Ein vollständiger Workspace-Sync würde umfangreiche TV-Testpakete, Referenzbilder und alte Projektkopien statt nur der benötigten Release-Quellen übertragen.

**How to apply:** App-Quellen, native Projektdateien, Konfigurationen, öffentliche Laufzeitmedien und tatsächlich referenzierte `@assets`-Dateien behalten. Lokale Dateien und lokale Checkpoint-Historie nicht löschen oder zurücksetzen. Ein bereinigter API-Snapshot erhält die bisherige GitHub-Historie als Parent, übernimmt aber nicht automatisch alle lokalen Zwischencommits; deshalb künftig nicht von identischen lokalen und entfernten Commit-Verläufen ausgehen. Den Remote-Tree gegen den bereinigten Export prüfen, nicht gegen den ungefilterten Workspace-Tree.