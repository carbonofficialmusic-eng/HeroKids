---
name: GitHub-Connector für Branch-Sync
description: Sicherer API-Fallback, wenn die lokale Git-Remote trotz aktiver Replit-GitHub-Verbindung nicht authentifiziert ist.
---

**Rule:** Eine aktive Replit-GitHub-Connector-Verbindung authentifiziert nicht automatisch `git push` gegen eine lokale HTTPS-Remote. Wenn ein vollständiger Branch-Stand über die GitHub-Git-API übertragen werden muss, erst die Live-Ref gegen den erwarteten Ausgangs-Commit prüfen und dann einen nicht erzwungenen Ref-Update verwenden.

**Why:** Der lokale Push kann wegen fehlender HTTPS-Anmeldung scheitern, obwohl der Connector `repo`-Schreibrechte hat. Ein vollständiger rekursiver Tree-Request kann über den Connector mit HTTP 502 scheitern; ein kleiner Tree mit `base_tree` und nur geänderten oder gelöschten Einträgen funktioniert.

**How to apply:** Remote-Ref und Parent-SHA vor jedem Schreibvorgang vergleichen. Neue Blobs hochladen, einen kompakten Tree auf dem vorhandenen Remote-Tree aufbauen, einen Commit mit dem geprüften Parent erzeugen und die Branch-Ref nur mit `force: false` aktualisieren. Connector-Fehler 502/503/504 pro Blob mit begrenztem Backoff wiederholen; sie können vor dem Ref-Update transient auftreten. Abschließend Remote-Tree-SHA und lokalen Tree-SHA vergleichen.

Bei größeren Migrationen Verzeichnisse mit ihren unmittelbaren Einträgen einzeln aufbauen statt alle verschachtelten Dateien in einem einzigen Tree-Request zu senden. Neue UTF-8-Blobs können über unreferenzierte kleine Staging-Trees mit `content` gebündelt werden; binäre Blobs brauchen Base64-Uploads. Jede zurückgegebene Objekt-SHA gegen Git prüfen.

**Why:** Auch ein Request mit ausschließlich vorhandenen Blob-SHAs kann als großer flacher Tree beim Connector mit „Server Error“ scheitern. Kleine direkte Verzeichniseinträge funktionieren; ein Blob-Upload pro Textdatei würde unnötig viele Schreibanfragen verursachen.

**How to apply:** Zuerst alle benötigten Objekte hochladen und den vollständigen erwarteten Release-Tree prüfen. Erst danach Commit und nicht erzwungenes Ref-Update erzeugen. Zeitweilige Serverfehler bei inhaltsadressierten Objekten begrenzt wiederholen, nicht unbesehen Branch-Mutationen erneut ausführen.

## Freigegebener Release-Umfang

Der Nutzer hat ausdrücklich freigegeben, Backups, Test-ZIPs, generierte native Ausgabe und unbenötigte Uploads aus dem GitHub-Release-Stand auszunehmen; lokale Dateien bleiben erhalten.

**Why:** Ein vollständiger Workspace-Sync würde umfangreiche TV-Testpakete, Referenzbilder und alte Projektkopien statt nur der benötigten Release-Quellen übertragen.

**How to apply:** App-Quellen, native Projektdateien, Konfigurationen, öffentliche Laufzeitmedien und tatsächlich referenzierte `@assets`-Dateien behalten. Lokale Dateien und lokale Checkpoint-Historie nicht löschen oder zurücksetzen. Ein bereinigter API-Snapshot erhält die bisherige GitHub-Historie als Parent, übernimmt aber nicht automatisch alle lokalen Zwischencommits; deshalb künftig nicht von identischen lokalen und entfernten Commit-Verläufen ausgehen. Den Remote-Tree gegen den bereinigten Export prüfen, nicht gegen den ungefilterten Workspace-Tree.

## Gewählter Übertragungsweg

Der normale Replit-Push ist wieder der gewünschte Arbeitsablauf; der Nutzer hat die sichere lokale Angleichung ausdrücklich freigegeben.

**Why:** Nach Erklärung, dass lokale Dateien und der bisherige Verlauf erhalten bleiben können, hat der Nutzer die vorherige Entscheidung geändert und die Rückkehr zum normalen Workflow gewünscht.

**How to apply:** Den alten lokalen Verlauf separat sichern, `publish` auf der bestehenden GitHub-Historie fortsetzen und lokale Release-Ausschlüsse beibehalten. Alte unbereinigte Zwischencommits nicht hineinmergen. Git-Anmeldung getrennt vom Connector prüfen; keine vollständige Push-Bereitschaft behaupten, solange die normale Git-Anmeldung scheitert. Die Einrichtung allein erlaubt noch keinen echten Push oder neuen Cloud-Build.

## Git-Anmeldung unabhängig vom Verbindungsstatus prüfen

Eine als „Active“ angezeigte GitHub-Verbindung und eine erneute Anmeldung im Replit-Git-Bereich garantieren hier keinen funktionierenden HTTPS-Push aus der Agent-Shell.

**Why:** Die erneuerte Git-Verbindung behob den Shell-Anmeldefehler nicht. Erst die separate Browser-Anmeldung der GitHub CLI und deren Verwendung als Git-Credential-Helper ermöglichten einen erfolgreichen normalen Push-Probelauf. Die funktionierende GitHub-App-Connector-Verbindung musste dafür nicht getrennt werden.

**How to apply:** Den tatsächlich verwendeten Schreibweg prüfen. Bei diesem Anmeldeproblem die GitHub-CLI-Browserautorisierung nutzen, statt wiederholt Verbindungen zu löschen oder Tokens im Chat anzufordern. Nach einer Änderung den Schreibzugriff und einen `git push --dry-run` bestätigen; ein Probelauf erteilt keine Freigabe für einen echten Push.