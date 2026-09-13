---
name: Frontend-Laufzeitvalidierung
description: Warum ein erfolgreicher Produktions-Build allein Render-Abstürze in React-Komponenten nicht ausschließt.
---

Ein erfolgreicher Vite-/esbuild-Produktions-Build bestätigt in diesem Projekt nicht, dass alle im JSX verwendeten Bezeichner importiert oder im richtigen Komponenten-Scope definiert sind.

**Why:** Fehlende Symbolimporte und eine Sprachvariable im falschen Unterbaustein bestanden den Build, führten aber erst beim Rendern bestimmter Aufgabenzustände zu einem vollständig schwarzen Bildschirm.

**How to apply:** Nach Änderungen an bedingt gerenderten React-Zweigen zusätzlich den betreffenden Scope mit TypeScript prüfen und einen Renderpfad abdecken. Bei einem projektweit bereits fehlschlagenden TypeScript-Check dessen Ausgabe gezielt nach neuen Fehlern in der geänderten Datei filtern.