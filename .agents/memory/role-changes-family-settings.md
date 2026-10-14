---
name: Rollenwechsel nur in Familieneinstellungen
description: Produkt- und Sicherheitsregel für die Bearbeitung von Mitgliedsrollen
---

Rollenwechsel gehören ausschließlich in die Familieneinstellungen eines Elternteils. Die Bearbeitung des eigenen Profils bietet unabhängig vom Anmeldeweg keine Rollenwahl; Name, Avatar und Farbe bleiben bearbeitbar.

**Why:** Ein Kind konnte in seinem Profil „Eltern“ auswählen und erst beim Speichern eine Fehlermeldung erhalten. Beim User Switch bleibt außerdem das Elternkonto im Hintergrund angemeldet, sodass allein die Kontorolle keine ausreichende Grenze für Rollenwechsel in der Kinderansicht ist.

**How to apply:** Bei neuen Profil-Dialogen den Ort und den aktuell gewählten Mitgliedskontext berücksichtigen. Ein aktiver User Switch darf nicht zur Rollenerhöhung genutzt werden, selbst wenn das zugrunde liegende Konto ein Elternkonto ist.