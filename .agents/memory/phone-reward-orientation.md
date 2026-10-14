---
name: Belohnungsübersicht nach Handy-Ausrichtung
description: Vom Nutzer bestätigte Grenze für kompakte Belohnungskarten auf iOS und im mobilen Web.
---

Das kompakte 2×2-Raster mit höchstens vier Belohnungen gilt nur im Querformat auf dem Telefon. Die bisherige Hochformatdarstellung soll unverändert bleiben.

**Why:** Der Nutzer stellte ausdrücklich klar, dass die gewünschte Verkleinerung nur das Querformat betrifft, nicht das Hochformat.

**How to apply:** Änderungen an der mobilen Belohnungsübersicht nach Ausrichtung begrenzen. Diese Vorgabe gilt für die bestehende iOS-App und die Web-App auf dem Telefon; TV und Desktop nicht dafür umgestalten.

Querformat-Änderungen nicht allein mit einem schmalen, touch-emulierten Browser prüfen. Auch breite, kurze WebViews ohne `pointer: coarse` testen und Eltern- und Kinderboard getrennt prüfen.

**Why:** Nach der Veröffentlichung waren beide kompakten Ansichten auf dem echten iOS-Gerät weiterhin unverändert. Die Änderungen lagen korrekt auf beiden Produktionsdomains. In Browsersimulationen wurden zu enge Media-Bedingungen und ein einengendes Desktop-Seitenraster gefunden; damit war die Ursache auf dem echten Gerät aber noch nicht bewiesen. Die bereits zweispaltige Elternansicht war kein Beleg dafür, dass die neuen Regeln griffen.

**How to apply:** Auch kurze Querformat-Viewports mit etwa 1024–1136 Pixeln Breite prüfen. Nicht nur das Media-Match, sondern die tatsächliche Breite des sichtbaren Leaderboards, Lesbarkeit der Platzierungen und die Kinder-Belohnungsübersicht messen. Hochformat und reguläres Desktop-Raster als Gegenprobe erhalten.

Der Nutzer prüft diese Änderungen in der veröffentlichten iOS-App aus dem App Store, nicht in TestFlight. Vollständiges Beenden und erneutes Öffnen beseitigte die Abweichung nicht.

**Why:** Eine korrekt veröffentlichte Webdatei und ein bestandener Chromium-Test beweisen weder die WebKit-Darstellung noch die tatsächlich im ausgelieferten iOS-Build verwendete Ladequelle.

**How to apply:** App-Store-Beobachtungen nicht als TestFlight- oder Vorschauproblem behandeln. Bei der Diagnose zwischen aktueller Quellkonfiguration, tatsächlich ausgeliefertem nativen Build und dessen geladener Oberfläche unterscheiden. Simulator-Ergebnisse mit künstlicher Geräteausrichtung ausdrücklich als Simulation kennzeichnen.
