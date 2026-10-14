---
name: LG-CLI-Geräteverbindung
description: Nicht offensichtliche Stolpersteine beim Verbinden eines älteren LG-webOS-TVs mit der aktuellen CLI.
---

Beim LG-Developer-Mode sind SSH und Schlüsselserver getrennte Verbindungen. Ein erreichbarer SSH-Port beweist nicht, dass die CLI den Schlüssel erneut abrufen kann. Die aktuelle CLI kann nach erfolgreichem Schlüsselabruf ohne sichtbare Erfolgsmeldung enden; ihr generischer „Callback was already called“-Fehler beweist weder eine falsche Passphrase noch einen Netzwerkausfall. Ältere TVs können ausschließlich ältere RSA-Signaturen anbieten, die moderne OpenSSH-Defaults ablehnen. Ausführliche CLI-Logs können Teile des privaten Schlüssels als Buffer ausgeben.

**Why:** Bei einer realen LG-webOS-5-Verbindung war direkte SSH-Anmeldung mit befehlslokalen RSA-Ausnahmen möglich, während LGs CLI weiterhin nur einen generischen Fehler meldete. Der Schlüsselserver war zwischenzeitlich ausgeschaltet, obwohl SSH erreichbar blieb.

**How to apply:** Bei künftigen Gerätetests beide Verbindungen getrennt und ohne Abruf von Schlüsselinhalten prüfen. Keine vollständigen Verbose-Logs oder Schlüsseldateien vom Nutzer anfordern. RSA-Ausnahmen nur befehlslokal einsetzen und aus generischen CLI-Fehlern keine bestimmte Ursache behaupten; nach wiederholtem Fehler einen geprüften alternativen Installationsweg verwenden.

Auf dem realen LG-webOS-5-Gerät funktionierte die Installation schließlich über eine direkte SSH-Verbindung und den TV-eigenen Developer-Mode-Installationsdienst. Sowohl die vorhandene als auch eine aktuelle CLI scheiterte zuvor mit demselben generischen Callback-Fehler, obwohl der SSH-Port erreichbar war.

**Why:** Der Nutzer bestätigte ausdrücklich, dass dieser alternative Installationsweg erfolgreich war. Ein CLI-Update oder bloßes Wiederholen des Installationsbefehls hätte das konkrete Problem nicht behoben.

**How to apply:** Bei erneutem CLI-Fehler zuerst die direkte Verbindung prüfen; wenn sie funktioniert, den bestätigten SSH-basierten Installationsweg vor weiteren CLI-Wechseln bevorzugen. Private Schlüssel und Passphrasen bleiben ausschließlich auf dem Rechner des Nutzers; niemals Debug-Ausgaben anfordern, die Schlüsselmaterial enthalten könnten.

Auf einem Mac kann `ares-install` vorhanden sein, während `ares-package` im Suchpfad fehlt. Ein mit `&&` verketteter Entpack-/Paketier-/SSH-Befehl hält dann vor dem SSH-Aufruf an; das Ausbleiben einer Passphrase-Abfrage ist kein Hinweis auf einen Schlüsseldefekt. Für diesen Fall ist eine fertig bereitgestellte webOS-IPK sinnvoller als erneute CLI-Einrichtung. Das webOS-IPK-Format ist ein Debian-ar-Archiv mit `debian-binary`, `control.tar.gz` und `data.tar.gz`; die Daten enthalten die App unter `usr/palm/applications/<id>` und die Paketmetadaten unter `usr/palm/packages/<id>`. Die webOS-CLI schreibt ar-Header ohne den von GNU `ar` angehängten `/` im Dateinamen und mit `100644` statt `644` im Modusfeld.

**Why:** Der Mac hatte beim Aktualisieren des Testpakets nur den ZIP-Build, aber kein `ares-package`; dadurch wurde keine IPK erzeugt und SSH nie erreicht. Eine manuell mit GNU `ar` erzeugte IPK bestand `dpkg-deb -I`, wurde vom echten LG-TV aber mit „ipk verified failed“ abgewiesen. Die strukturelle Debian-Prüfung reicht also nicht.

**How to apply:** Bei ausbleibender SSH-Abfrage zuerst auf frühere Befehlsfehler und eine existierende IPK prüfen. Wenn der Packager fehlt, möglichst mit der offiziellen CLI bauen; ein Ersatz muss auch ihre ar-Header spiegeln und gilt erst nach erfolgreichem TV-Test als bestätigt. Keine strukturelle Prüfung als Gerätestest darstellen.

Beim erneuten Ausgeben des bestätigten Mac-Installationswegs dessen Befehlsfolge beibehalten: fertige IPK herunterladen, Schlüssel mit `ssh-add` laden, IPK über `ssh -T` und umgeleitete Standardeingabe auf den TV übertragen, danach den Developer-Mode-Installationsdienst aufrufen.

**Why:** Der Nutzer hat den zuvor funktionierenden vollständigen Befehl erneut bereitgestellt und ausdrücklich dieselbe Vorgehensweise verlangt. Ein Wechsel zu `ares-install`, SCP oder erneutem Paketieren ist für diesen Gerätefall nicht erforderlich.

**How to apply:** Nur Version, Paketname und temporären TV-Dateinamen aktualisieren. Der bestätigte Aufruf verwendet `luna-send-pub -i`, `luna://com.webos.appInstallService/dev/install`, `id: "com.ares.defaultName"` und `subscribe: true`. SSH-Optionen sind `HostKeyAlgorithms=+ssh-rsa`, `PubkeyAcceptedAlgorithms=+ssh-rsa` und `IdentitiesOnly=yes`; die Übertragung erfolgt mit `ssh -T ... 'cat > /tmp/<paket>.ipk' < <lokale-ipk>`. Geräteadresse und konkreten Schlüsselpfad ausschließlich aus dem aktuellen Nutzerbefehl übernehmen, niemals in Projektmemory speichern.