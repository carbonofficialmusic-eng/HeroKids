---
name: TV-Zielplattform LG webOS
description: Warum die TV-Begleitapp LG webOS statt Samsung Tizen priorisiert.
---

Die TV-Begleitapp soll für LG webOS 5 bereitgestellt und zuerst auf einem echten LG-TV geprüft werden. Samsung/Tizen wurde bewusst als Ziel aufgegeben; die frühere Samsung-Paketierung nicht stillschweigend wiederherstellen.

**Why:** Das verfügbare reale Testgerät läuft mit LG webOS, nicht mit Samsung Tizen. Ein PC mit Samsung-Emulator ist nur gelegentlich verfügbar und kein Ersatz für die Geräteprüfung.

**How to apply:** TV-Veröffentlichungen und Plattformentscheidungen an LG webOS 5 und einem echten Gerät ausrichten. Web- und iOS-App weiterhin als gemeinsame Bestandteile desselben Projekts vor jeder Veröffentlichung auf Regressionen prüfen.

Ein Build-Ziel für Chromium 68 übersetzt Syntax, ergänzt aber fehlende Laufzeit-Globals nicht automatisch. Auf dem echten webOS-5-Gerät erschien zunächst nur eine weiße Fläche; nach einem frühen Kompatibilitäts-Shim für `globalThis` wurde der Kopplungsbildschirm sichtbar.

**Why:** Ein erfolgreicher Build und die Browser-Vorschau hatten diesen Startfehler nicht erkannt; erst der Test auf dem tatsächlichen TV bestätigte die Ursache und die wirksame Abhilfe.

**How to apply:** Bei Änderungen an TV-Abhängigkeiten fehlende Laufzeit-APIs gesondert prüfen und den Paketstart erneut auf einem webOS-5-Gerät testen. Einen weißen Bildschirm nicht allein durch erfolgreiche Transpilation als ausgeschlossen betrachten.

TV-Fernbedienungsfokus darf nicht ausschließlich auf `:focus-visible` beruhen: Der ältere TV-Browser verwirft diese Auswahlregel und zeigt dann trotz funktionierender Pfeilnavigation keine Markierung. Ebenso muss der anfängliche Fokus erst nach dem asynchronen Laden der bedienbaren Oberfläche gesetzt werden.

**Why:** Die Kopplung funktionierte auf dem echten TV, doch die Code-Tasten waren für den Nutzer ohne sichtbare Auswahl schwer zu bedienen; die Browser-Vorschau zeigte zusätzlich, dass bei anfänglichem Ladebildschirm keine Taste fokussiert wurde.

**How to apply:** Für TV-Bedienelemente mit `:focus` oder einer expliziten Fokusklasse gestalten und den ersten bedienbaren Knopf nach dem Laden fokussieren. Änderungen an der Fernbedienungsführung möglichst auf dem realen Gerät bestätigen.

Vor einer ausdrücklich freigegebenen Veröffentlichung soll ein LG-Testpaket den laufenden Replit-Entwicklungsserver ansprechen, nicht die Produktionsdomain. Eine andere Zieladresse erfordert ein neu gebautes Paket; eine bloße Neuinstallation desselben Pakets ändert sie nicht.

**Why:** Der Nutzer testet neue TV-Funktionen zunächst aus Replit. Ein testweise mit der Produktionsdomain gebautes Paket erhielt dort 404 für einen noch nicht veröffentlichten TV-Endpunkt.

**How to apply:** Vor dem Paketieren das gewünschte Testziel klären und die eingebettete Entwicklungsadresse samt Erreichbarkeit prüfen. Kopplung und Genehmigung müssen auf derselben Entwicklungsumgebung stattfinden; nicht vorschnell zum Republish raten.

Die vorhandenen Beschriftungsgrößen auf der TV-Skin-Seite beibehalten, solange keine zwingende LG-Vorgabe oder ein tatsächliches Lesbarkeitsproblem entgegensteht. Die 20-px-Empfehlung ist keine verpflichtende Mindestgröße.

**Why:** Der Nutzer hat die Skin-Seite auf dem realen LG-Fernseher angesehen und die Beschriftungen nicht als störend empfunden; er möchte sie nicht allein wegen einer unverbindlichen Richtgröße ändern.

**How to apply:** Bei einer LG-Checklistenprüfung die vorhandene Lesbarkeit am Gerät prüfen und dokumentieren, statt die Skin-Seite vorbeugend umzugestalten.

Auf webOS 5 soll die Zurück-Taste auf der obersten App-Seite an die TV-Home-Oberfläche übergeben werden. LGs `webOS.platformBack()` delegiert dafür an die native `PalmSystem.platformBack()`-Schnittstelle; `window.close()` ist nur ein Browser-Fallback.

**Why:** Die LG-Store-Checkliste prüft den Startseiten-Back-Button, und ein einfaches Fenster-Schließen bildet das geforderte Home-Verhalten nicht zuverlässig ab.

**How to apply:** Die Unterseiten-Navigation unverändert lassen, auf der Startseite die native TV-Funktion nutzen und den tatsächlichen Übergang auf einem LG-Gerät verifizieren.

Keine scheinbare TV-Token-Verschlüsselung mit einem Schlüssel im App-Paket implementieren: LGs Keymanager3-Dienst ist auf webOS 5 nicht verfügbar, während dauerhafte Anmeldung derzeit lokale Speicherung braucht.

**Why:** Ein im Paket mitgelieferter Entschlüsselungsschlüssel verbessert die Sicherheit nicht; nur Sitzungsspeicherung zu deaktivieren würde die bestehende Kopplung nach jedem Neustart zunichtemachen.

**How to apply:** Vor einer öffentlichen Store-Einreichung die lokale Token-Speicherung ehrlich in LGs Datenschutz-/Zugangsdatenprüfung erfassen und eine echte Sicherheitslösung oder eine vom Nutzer akzeptierte kürzere TV-Sitzung wählen.