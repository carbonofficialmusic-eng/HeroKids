---
name: Gesperrte Belohnungen nach Theme
description: Bestätigte visuelle Trennung für noch nicht einlösbare Belohnungen auf Boards und der Shop-Gesamtansicht.
---

Noch nicht einlösbare Belohnungen verwenden auf Kinder- und Eltern-Board sowie in „Alle ansehen“ zwei klar getrennte Designs: Im Light Mode bleibt die Karte warm und cremefarben, mit dunkel lesbarem Titel und blauem Fortschrittsbalken. Im Dark Mode wird die gesamte Karte stahlblau gestaltet.

**Why:** Die vollständig stahlblaue Karte im Light Mode war ausdrücklich nicht gewünscht; der Nutzer bestätigte die helle Referenzkarte mit blauem Ladebalken als Light-Mode-Ziel.

**How to apply:** Theme-übergreifende Selektoren für gesperrte Belohnungskarten vermeiden. Vollständige Stahlblau-Regeln ausschließlich unter `html.dark` halten; im Light Mode auf Boards und in „Alle ansehen“ nur die blauen Fortschrittselemente und ausreichenden Textkontrast erzwingen.