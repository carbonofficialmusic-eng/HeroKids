---
name: Punkte-Rückerstattungen
description: Dauerhafte Invariante und Nebenläufigkeitsregel für verfügbare und lebenslang verdiente Punkte.
---

Verfügbare Punkte müssen immer zwischen null und dem Lebenszeitverdienst liegen. Belohnungs- und Familienziel-Rückerstattungen müssen das zugrunde liegende Objekt innerhalb derselben Transaktion sperren, damit parallele Anfragen nicht doppelt erstatten.

**Why:** Zwei Produktionskonten erhielten denselben verwaisten 40-Punkte-Refund. Ihre positiven Punktehistorien stimmten mit dem Lebenszeitverdienst überein, während der verfügbare Stand um 40 höher war. Reines Begrenzen ohne Sperre hätte die Ursache nur verdeckt.

**How to apply:** Bei neuen Abbuchungs- oder Rückerstattungswegen nicht auf vorher gelesene Werte vertrauen. Objekt und betroffene Mitglieder transaktional und in stabiler Reihenfolge sperren, tatsächliche statt nominale Refund-Deltas melden und `0 <= verfügbar <= total verdient` erzwingen.