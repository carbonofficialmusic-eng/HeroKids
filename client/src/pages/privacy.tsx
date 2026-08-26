import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function Privacy() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen bg-background p-4 md:p-8"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>

        <Card data-testid="card-privacy-policy">
          <CardHeader>
            <h1 className="text-2xl md:text-3xl font-semibold" data-testid="title-privacy-policy">
              Datenschutzerklärung / Privacy Policy
            </h1>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <p className="text-muted-foreground" data-testid="text-last-updated">Stand: Juni 2026</p>

            {/* ─── DEUTSCH ─────────────────────────────────────────────────── */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">1. Verantwortlicher</h2>
              <p>
                Verantwortlicher im Sinne der DSGVO:
              </p>
              <p className="mt-2">
                Sonoa · Riewert Petersen<br />
                Warnstedtstr. 59a · 22525 Hamburg<br />
                E-Mail: <a href="mailto:info@littlechamps.net" className="underline">info@littlechamps.net</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">2. Erhobene Daten</h2>
              <h3 className="text-base font-medium mt-4 mb-2">Kontoinformationen</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Vor- und Nachname sowie E-Mail-Adresse (bei Registrierung)</li>
                <li>Profilbild (optional)</li>
                <li>Namen und Rollen der Familienmitglieder</li>
              </ul>

              <h3 className="text-base font-medium mt-4 mb-2">Nutzungsdaten</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Erstellte und erledigte Aufgaben</li>
                <li>Verdiente Punkte und eingelöste Belohnungen</li>
                <li>App-Einstellungen und Präferenzen</li>
              </ul>

              <h3 className="text-base font-medium mt-4 mb-2">Fotos</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Aufgabenbeweisfotos (sofern hochgeladen) — werden nach 30 Tagen automatisch gelöscht</li>
                <li>Profilavatare (sofern hochgeladen)</li>
              </ul>

              <h3 className="text-base font-medium mt-4 mb-2">Zahlungsdaten</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Zahlungen werden ausschließlich über Stripe abgewickelt. Little Champs speichert keine Kreditkartendaten.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">3. Zweck der Datenverarbeitung</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Bereitstellung und Betrieb des Little Champs-Dienstes</li>
                <li>Verwaltung des Kontos und der Familienmitgliedschaft</li>
                <li>Verarbeitung von Aufgabenabschlüssen und Belohnungen</li>
                <li>Versand wichtiger Benachrichtigungen (E-Mail-Verifizierung, Passwort-Reset)</li>
                <li>Verbesserung der Anwendung</li>
              </ul>
              <p className="mt-2">
                Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
              </p>
            </section>

            <section data-testid="section-data-storage">
              <h2 className="text-xl font-semibold mt-6 mb-3">4. Datenspeicherung und Sicherheit</h2>
              <p>
                Daten werden verschlüsselt in einer Cloud-Datenbank (Neon PostgreSQL, USA) gespeichert.
                Fotos werden in Replit Object Storage (Google Cloud, USA) abgelegt.
                Die Übertragung erfolgt ausschließlich über HTTPS.
                Passwörter werden mit bcrypt gehasht und niemals im Klartext gespeichert.
              </p>
              <p className="mt-2">
                Für die Datenverarbeitung in Drittländern (USA) bestehen geeignete Garantien gemäß Art. 46 DSGVO
                (Standardvertragsklauseln der EU-Kommission).
              </p>
            </section>

            <section data-testid="section-data-sharing">
              <h2 className="text-xl font-semibold mt-6 mb-3">5. Weitergabe von Daten</h2>
              <p>
                Wir verkaufen keine personenbezogenen Daten. Daten werden nur innerhalb der Familiengruppe
                im Rahmen der App-Funktionalität geteilt.
              </p>
              <p className="mt-2">Auftragsverarbeiter (Art. 28 DSGVO):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Neon Inc.</strong> — Datenbankhosting (USA)</li>
                <li><strong>Replit Inc.</strong> — Hosting &amp; Objektspeicher (USA)</li>
                <li><strong>Stripe Inc.</strong> — Zahlungsabwicklung (USA)</li>
                <li><strong>Resend Inc.</strong> — E-Mail-Versand (USA)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">6. Kinderdaten</h2>
              <p>
                Little Champs ist für die Nutzung durch Familien konzipiert. Kinderkonten werden
                ausschließlich durch die Eltern erstellt — Kinder registrieren sich nicht selbst.
                Eltern haben jederzeit die volle Kontrolle über die Daten ihrer Kinder und können
                diese über die App-Einstellungen löschen.
              </p>
              <p className="mt-2">
                Die Datenverarbeitung von Kindern unter 16 Jahren erfolgt auf Grundlage der
                elterlichen Einwilligung, die durch die Registrierung und Anlage des Kinderkontos
                durch den Elternteil erteilt wird (Art. 8 DSGVO).
              </p>
              <p className="mt-2">
                Für Kinder unter 13 Jahren werden keine eigenständigen Registrierungsdaten erfasst.
                Die Verknüpfung des Kindergeräts erfolgt anonym über einen sicheren Gerätecode,
                der vom Elternkonto generiert wird. Es werden keine personenbezogenen Daten des
                Kindes (Name, E-Mail, Geburtsdatum) direkt erhoben oder an Dritte weitergegeben.
                Drittanbieter-Tracking oder Werbenetze sind im Kindermodus vollständig deaktiviert.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">7. Betroffenenrechte (DSGVO)</h2>
              <p>Sie haben das Recht auf:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Auskunft</strong> (Art. 15 DSGVO) — welche Daten wir über Sie speichern</li>
                <li><strong>Berichtigung</strong> (Art. 16 DSGVO) — unrichtige Daten korrigieren lassen</li>
                <li><strong>Löschung</strong> (Art. 17 DSGVO) — Ihr Konto und alle Daten löschen lassen</li>
                <li><strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
                <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
                <li><strong>Widerspruch</strong> (Art. 21 DSGVO) gegen die Verarbeitung</li>
                <li><strong>Widerruf der Einwilligung</strong> jederzeit mit Wirkung für die Zukunft</li>
              </ul>
              <p className="mt-2">
                Zur Ausübung Ihrer Rechte kontaktieren Sie uns bitte unter:{" "}
                <a href="mailto:info@littlechamps.net" className="underline font-medium">info@littlechamps.net</a>
              </p>
              <p className="mt-2">
                Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren,
                z.B. beim Hamburgischen Beauftragten für Datenschutz und Informationsfreiheit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">8. Speicherdauer</h2>
              <p>
                Daten werden so lange gespeichert, wie Ihr Konto aktiv ist. Nach Kontolöschung
                werden alle personenbezogenen Daten innerhalb von 30 Tagen dauerhaft entfernt.
                Aufgabenbeweisfotos werden nach 30 Tagen automatisch gelöscht.
              </p>
            </section>

            <section data-testid="section-cookies">
              <h2 className="text-xl font-semibold mt-6 mb-3">9. Cookies</h2>
              <p>
                Wir verwenden ausschließlich technisch notwendige Cookies für die Authentifizierung
                und Session-Verwaltung (httpOnly, Secure). Es werden keine Tracking- oder
                Marketing-Cookies eingesetzt. Eine Cookie-Einwilligung ist daher nicht erforderlich
                (§ 25 Abs. 2 Nr. 2 TDDDG).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">10. Kontakt</h2>
              <p>
                Bei Fragen zu dieser Datenschutzerklärung oder Ihren Daten wenden Sie sich bitte an:
              </p>
              <p className="mt-2">
                <a href="mailto:info@littlechamps.net" className="underline font-medium">info@littlechamps.net</a>
              </p>
            </section>

            <hr className="my-8" />

            {/* ─── ENGLISH ─────────────────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">Privacy Policy (English)</h2>
              <p className="text-muted-foreground">Last updated: June 2026</p>

              <h3 className="text-base font-medium mt-4 mb-2">1. Data Controller</h3>
              <p>
                Sonoa · Riewert Petersen · Warnstedtstr. 59a · 22525 Hamburg, Germany<br />
                Email: <a href="mailto:info@littlechamps.net" className="underline">info@littlechamps.net</a>
              </p>

              <h3 className="text-base font-medium mt-4 mb-2">2. Data We Collect</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>First name, last name, email address (at registration)</li>
                <li>Profile picture (optional)</li>
                <li>Family member names and roles</li>
                <li>Tasks, points, and rewards activity</li>
                <li>Task proof photos (auto-deleted after 30 days)</li>
              </ul>

              <h3 className="text-base font-medium mt-4 mb-2">3. How We Use Your Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and operate the Little Champs service</li>
                <li>To manage accounts and family membership</li>
                <li>To send transactional emails (verification, password reset)</li>
                <li>To improve our application</li>
              </ul>
              <p className="mt-2">Legal basis: Art. 6(1)(b) GDPR (contract performance) and Art. 6(1)(a) GDPR (consent).</p>

              <h3 className="text-base font-medium mt-4 mb-2">4. Data Storage & Security</h3>
              <p>
                Data is stored encrypted in Neon PostgreSQL (USA). Photos are stored in Replit Object
                Storage (Google Cloud, USA). All data is transmitted over HTTPS. Passwords are hashed
                with bcrypt and never stored in plain text.
              </p>

              <h3 className="text-base font-medium mt-4 mb-2">5. Children's Privacy</h3>
              <p>
                Child accounts are created exclusively by parents — children do not register themselves.
                Parents retain full control over their children's data and can delete it at any time.
                Processing of data for children under 16 is based on parental consent given at registration (Art. 8 GDPR).
              </p>
              <p className="mt-2">
                For children under 13, no independent registration data is collected. Device linking
                is performed anonymously via a secure device code generated by the parent account.
                No personal data of the child (name, email, date of birth) is directly collected or
                shared with third parties. Third-party tracking and ad networks are fully disabled
                in child mode.
              </p>

              <h3 className="text-base font-medium mt-4 mb-2">6. Your Rights</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access, rectification, erasure, restriction, portability, objection</li>
                <li>Withdraw consent at any time</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>
              <p className="mt-2">
                Contact: <a href="mailto:info@littlechamps.net" className="underline">info@littlechamps.net</a>
              </p>

              <h3 className="text-base font-medium mt-4 mb-2">7. Cookies</h3>
              <p>
                We use only technically necessary cookies for authentication and session management.
                No tracking or marketing cookies are used.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
