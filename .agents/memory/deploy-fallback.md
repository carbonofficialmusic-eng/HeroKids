---
name: Deploy-Fallback für Web-Navigation
description: Verbindliche Strategie für den gebrandeten Wartungsbildschirm während eines Deployment-Wechsels.
---

Für wiederkehrende Webnutzer wird ein eigenständiger, gecachter „Gleich zurück“-Bildschirm über einen Service Worker als Fallback für fehlgeschlagene oder mit 5xx beantwortete Seitennavigationen bereitgestellt.

**Why:** Während eines Deployment-Wechsels kann bereits der Replit-Proxy das HTML-Dokument mit 5xx beantworten. Dann wird React nicht geladen und der normale Status-Guard kann keinen Wartungsbildschirm anzeigen.

**How to apply:** Den Fallback nur für Dokumentnavigationen verwenden, nicht für API-Aufrufe. Nach Wiederherstellung regelmäßig prüfen und die App automatisch neu laden. Ein Erstbesuch während des Ausfalls bleibt technisch außerhalb der Kontrolle der App.