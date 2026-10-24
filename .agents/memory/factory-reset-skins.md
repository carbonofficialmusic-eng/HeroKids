---
name: Factory Reset für Skins und Sterne
description: Verbindliche Ausgangslage für profilgetrennte Skin- und Sternstände nach einem Familien-Reset.
---

**Rule:** Ein Factory Reset setzt jedes Familienmitglied unabhängig auf 0 gefundene Sterne, keine entdeckten oder Legacy-Skins, keinen aktiven Skin und aktivierten Theme-Hintergrund zurück. Jedes Profil erhält eine neue persönliche Dreierauswahl; Eltern beginnen wieder beim Startbildschirm mit erster Aufgabe, Kartenauswahl und Tour. Die 48 Sternpositionen entstehen erst atomar bei der Kartenauswahl, außerhalb der gewählten Gratis-Karte.

**Why:** Globale Client-Caches und verzögert erzeugte Sternpositionen führten nach Profilwechseln zu widersprüchlichen Sternzahlen und Freischaltungen. Eine versteckte Produktions-Testfunktion konnte außerdem dauerhaft alle Skins eines Profils freischalten.

**Why:** Am 24. Oktober 2026 hat der Nutzer ausdrücklich festgelegt, dass ein Factory Reset wieder zum neuen Startbildschirm führt. Diese Anweisung ersetzt die vorherige Beibehaltung des historischen Starter-Skins. Abos und bereits genutzte Trials werden dadurch nicht erneuert.

**How to apply:** Alle profilabhängigen Abfragen müssen die Mitglieds-ID im Cache-Schlüssel tragen und beim Profilwechsel invalidiert werden. Factory Reset löscht Client-Caches auf allen verbundenen Geräten. Die ausdrücklich gewünschte versteckte 7-Klick-Funktion schaltet nur das aktive Profil frei und muss Sternpositionen, Zähler, Karten und Legacy-Skins atomar synchron halten.