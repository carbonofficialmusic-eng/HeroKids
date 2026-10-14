---
name: LG-webOS-5-CSS-Kompatibilität
description: Beobachtete Browser-Grenzen der installierten LG-TV-App beim Layout.
---

Auf dem getesteten LG-TV mit webOS 5 wurde eine Bildgröße mit CSS `clamp()` ignoriert; das Logo erschien stattdessen in annähernder Originalgröße. Bei TV-kritischen Größen feste Pixelwerte mit klassischen Media Queries verwenden.

**Why:** Die Desktop-Vorschau zeigte nicht denselben Fehler, während ein Foto des installierten Pakets das übergroße Logo belegte. Der TV-Browser basiert auf einer älteren Chromium-Version.

**How to apply:** Änderungen am installierbaren TV-Layout nicht allein aus einer modernen Webvorschau beurteilen. CSS-Eigenschaften auf die Ziel-Browser-Version prüfen und bei Bildgrößen eine tatsächlich unterstützte Fallback-Größe festlegen.

Auch `gap` in Flexbox wird von Chromium 68 ignoriert. Für kritische horizontale und vertikale Abstände explizite Randabstände verwenden, auch zwischen den Abschnitten einer Aufgabenkarte; Grid-Abstände sind davon zu unterscheiden.

**Why:** Fotos des echten LG-TVs zeigten zuerst Profiltexte direkt am Avatar und später Status, Inhalt und Wiederholungsbadge einer Aufgabenkarte dicht aneinander, obwohl im Stylesheet Flex-Abstände vorgesehen waren.

**How to apply:** Flex-Abstände für den Ziel-TV nicht ausschließlich mit `gap` definieren. Bei einem Margin-Fallback die Flex-Abstände auch in spezifischeren Regeln auf null setzen, damit moderne Browser nicht beide Abstände addieren. Änderungen mit dem tatsächlichen Stylesheet prüfen, nicht nur anhand einer vereinfachten CSS-Kopie.

Zwischen Profilbild und Profiltext sind auf dem TV 36 Pixel vorgesehen, sowohl in der Mitgliederwahl als auch im Dashboard bei „Dein Profil“ und dem Namen.

**Why:** Der Nutzer hat ausdrücklich denselben Abstand auch auf den Dashboards verlangt; Profilbild und Text sollen auf den verschiedenen TV-Seiten einheitlich getrennt sein.

**How to apply:** Diesen Abstand bei Eltern- und Kinderprofilen beibehalten und weiterhin einen webOS-kompatiblen Margin statt eines alleinigen Flex-Gaps verwenden.