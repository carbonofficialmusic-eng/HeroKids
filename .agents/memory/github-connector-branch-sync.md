---
name: GitHub-Connector für Branch-Sync
description: Sicherer API-Fallback, wenn die lokale Git-Remote trotz aktiver Replit-GitHub-Verbindung nicht authentifiziert ist.
---

**Rule:** Eine aktive Replit-GitHub-Connector-Verbindung authentifiziert nicht automatisch `git push` gegen eine lokale HTTPS-Remote. Wenn ein vollständiger Branch-Stand über die GitHub-Git-API übertragen werden muss, erst die Live-Ref gegen den erwarteten Ausgangs-Commit prüfen und dann einen nicht erzwungenen Ref-Update verwenden.

**Why:** Der lokale Push kann wegen fehlender HTTPS-Anmeldung scheitern, obwohl der Connector `repo`-Schreibrechte hat. Ein vollständiger rekursiver Tree-Request kann über den Connector mit HTTP 502 scheitern; ein kleiner Tree mit `base_tree` und nur geänderten oder gelöschten Einträgen funktioniert.

**How to apply:** Remote-Ref und Parent-SHA vor jedem Schreibvorgang vergleichen. Neue Blobs hochladen, einen kompakten Tree auf dem vorhandenen Remote-Tree aufbauen, einen Commit mit dem geprüften Parent erzeugen und die Branch-Ref nur mit `force: false` aktualisieren. Abschließend Remote-Tree-SHA und lokalen Tree-SHA vergleichen.