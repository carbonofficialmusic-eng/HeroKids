---
name: Nahtloser Mitgliederwechsel
description: Visuelle Übergangsregel beim Wechsel zwischen Familienmitgliedern.
---

Beim Mitgliederwechsel bleibt der User Switch geöffnet, während der aktive Mitgliedsstand und das Zieldashboard wechseln. Er schließt erst, nachdem das neue Profil gerendert wurde.

**Why:** Wenn der Switch vor der Profilaktualisierung verschwindet, ist kurz das alte Dashboard sichtbar und der Wechsel wirkt verzögert.

**How to apply:** Den neuen Mitgliedsstand zuerst in den Client-Cache übernehmen, zum rollenabhängigen Dashboard wechseln und den Dialog erst nach dem nächsten bestätigten Render-Zyklus schließen.