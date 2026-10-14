---
name: Ein Anbieter pro aktivem Abo
description: Verbindliche Produktregel für Tarifwechsel und Anbieterwechsel zwischen Apple und Stripe.
---

Eine Familie darf immer nur ein aktives kostenpflichtiges Abonnement über einen Anbieter haben. Apple-Tarifwechsel erfolgen im App Store, Stripe-Tarifwechsel über die Stripe-Aboverwaltung. Ein Wechsel des Anbieters ist erst zulässig, wenn das bisherige Abo tatsächlich abgelaufen und die Familie wieder auf Free ist.

**Why:** Eine bloße Kündigung beendet den bezahlten Zeitraum nicht. Parallelabos verursachen doppelte Kosten und widersprüchliche Webhooks, bei denen der zuletzt meldende Anbieter den sichtbaren Tarif überschreiben oder trotz eines anderen aktiven Abos auf Free zurückstufen kann.

**How to apply:** Vor jedem Kauf den anderen Anbieter live prüfen und bei nicht eindeutig prüfbarem Status geschlossen blockieren. `cancel_at_period_end` und zukünftige Apple-Ablaufdaten gelten weiter als aktiv. Neue Stripe-Checkouts bei bestehendem Stripe-Abo vermeiden und stattdessen das Kundenportal öffnen.