---
name: Workspace-Paketverknüpfungen nach gefilterter Installation
description: Fehlende Vite-Dateien in anderen Artefakten nach Paketänderungen erkennen und vermeiden.
---

In diesem migrierten Workspace kann eine gefilterte Paketinstallation die Verknüpfungen anderer Artefakte auf nicht mehr vorhandene virtuelle Paketverzeichnisse zeigen lassen. Ein noch laufender Entwicklungsserver kann dabei scheinbar gesund bleiben.

**Why:** Nach der Installation des TV-Paketwerkzeugs blieb der normale Webserver aktiv, lieferte seinen Vite-Client aber als HTML statt JavaScript aus. Ein Neustart machte erst die fehlenden Paketdateien sichtbar; die vollständige Installation mit bestehendem Lockfile stellte die Verknüpfungen wieder her.

**How to apply:** Nach gefilterten Paketänderungen die Abhängigkeiten workspace-weit mit unverändertem Lockfile installieren und die betroffenen laufenden Entwicklungsserver neu starten. Bei weißer Vorschau nicht nur HTTP-Status und Port prüfen, sondern auch den Inhaltstyp der benötigten JavaScript-Dateien. Keine Produktcode- oder Versionsänderung vornehmen, wenn die Ursache nur die Paketverknüpfung ist.
