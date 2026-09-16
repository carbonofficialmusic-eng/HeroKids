---
name: Heutige Terminkarten
description: Freigegebene visuelle und logische Regeln für Aufgaben mit einem festen Termin am aktuellen Tag.
---

Offene, ausführbare Aufgaben mit einem manuell gesetzten Termin am aktuellen Kalendertag stehen innerhalb der Termine zuerst. Sie zeigen oben rechts ausschließlich die lokalisierte Bedeutung von „HEUTE“.

Im Dark Mode nutzt die Karte eine 2 px starke korallfarbene Umrandung in `#FF647C`, einen dezenten Glow `0 0 18px rgba(255, 100, 124, 0.30)` und eine Plakette mit Verlauf `#FF7A59 → #FF4F7B`. Im Light Mode wird stattdessen das Orange der Landingpage verwendet. Die blaue Terminzeile bleibt bestehen. Beim Öffnen leuchtet die Karte einmal sanft auf; bei reduzierter Bewegung gibt es keine Animation.

**Why:** Diese Richtung wurde nach einem Vergleich mit den echten Eltern- und Kinderboards ausdrücklich visuell freigegeben. Eine frühere generische, türkisfarbene Variante wurde abgelehnt.

**How to apply:** Die Hervorhebung gilt nur am exakten Termintag und nur für den offenen, ausführbaren Zustand. Einzeltermine werden ausschließlich beim zugewiesenen Mitglied hervorgehoben; Teamtermine bei jedem teilnehmenden Mitglied. Erledigt-, Genehmigungs-, Ablehnungs-, gesperrte und abgelaufene Zustände behalten ihre eigenen Statusfarben.