---
name: LG-TV-Testpakete herunterladen
description: Ausweichweg für nicht startende IPK-Downloads aus der Replit-App
---

Wenn ein LG-webOS-Testpaket als IPK in der Replit-App nicht heruntergeladen werden kann, einen direkten HTTPS-Download über den laufenden Entwicklungsserver und alternativ einen curl-Befehl für den Mac anbieten. Die Datei nicht ins öffentliche Vite-Asset-Verzeichnis kopieren.

**Why:** Der Nutzer konnte eine vorhandene und gültige IPK trotz erneut präsentierter Dateikarte nicht herunterladen. Ein über den Entwicklungsserver gestreamter Download wurde mit identischer Prüfsumme zur Paketdatei verifiziert. Eine Kopie im öffentlichen Asset-Verzeichnis würde in zukünftige TV-Pakete eingebaut.

**How to apply:** Bei neuen TV-Testversionen zuerst das Paket bauen und die direkte Downloadadresse sowie Dateigröße/Prüfsumme über die gemeinsame Vorschau prüfen; ausschließlich die Replit-Entwicklungsdomain verwenden und nichts veröffentlichen.

Für weitere TV-Updates ein ZIP mit der bereits fertigen IPK und den bisherigen Mac-Installationsweg anbieten, nicht erneut einen Build auf dem Mac verlangen.

**Why:** Der Nutzer wünscht die neue ZIP und den Befehl ausdrücklich „genau wie letztes Mal“. Der funktionierende Weg ist SSH; die Geräte-CLI scheiterte zuvor.

**How to apply:** Den vorhandenen erfolgreichen Installationsbefehl nur auf die neue Version umstellen. Fehlt dieser im verfügbaren Verlauf, nach dem Befehl ohne Passphrase oder Schlüsselinhalt fragen, statt Geräteadresse, Schlüsselpfad oder einen anderen Installationsweg zu erfinden. Gerätebezogene Angaben nicht in Projektmemory speichern.