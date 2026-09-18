---
name: Factory Reset für Skins und Sterne
description: Verbindliche Ausgangslage für profilgetrennte Skin- und Sternstände nach einem Familien-Reset.
---

**Rule:** Ein Factory Reset setzt jedes Familienmitglied unabhängig auf 0 gefundene Sterne, nur den Starter-Skin, keine Legacy-Skins, keinen aktiven Skin und aktivierten Theme-Hintergrund. Die 48 ungefundenen Sternpositionen werden für jedes Mitglied innerhalb derselben Reset-Transaktion neu erzeugt.

**Why:** Globale Client-Caches und verzögert erzeugte Sternpositionen führten nach Profilwechseln zu widersprüchlichen Sternzahlen und Freischaltungen. Eine versteckte Produktions-Testfunktion konnte außerdem dauerhaft alle Skins eines Profils freischalten.

**How to apply:** Alle profilabhängigen Abfragen müssen die Mitglieds-ID im Cache-Schlüssel tragen und beim Profilwechsel invalidiert werden. Factory Reset löscht Client-Caches auf allen verbundenen Geräten. Test-/Cheat-Endpunkte dürfen in Produktion nicht existieren.