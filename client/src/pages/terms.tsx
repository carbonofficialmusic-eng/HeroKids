import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Terms() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back-terms"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>

        <Card data-testid="card-terms">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl" data-testid="title-terms">
              Allgemeine Geschäftsbedingungen (AGB)
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <p className="text-muted-foreground">Stand: Juni 2026</p>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 1 Geltungsbereich</h2>
              <p>
                Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der
                webbasierten Anwendung <strong>HeroKids</strong>, betrieben von:
              </p>
              <p className="mt-2">
                Sonoa · Riewert Petersen<br />
                Warnstedtstr. 59a · 22525 Hamburg<br />
                E-Mail: <a href="mailto:info@herokids.app" className="underline">info@herokids.app</a>
              </p>
              <p className="mt-2">
                Mit der Registrierung eines Kontos erklärt sich der Nutzer mit diesen AGB
                einverstanden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 2 Leistungsbeschreibung</h2>
              <p>
                HeroKids ist eine Familien-Aufgabenverwaltungs-App, die Kindern durch
                Gamification-Elemente (Punkte, Belohnungen, Leaderboards) dabei hilft,
                Haushaltsaufgaben zu erledigen. Die App richtet sich an Familien mit Kindern
                und wird als Software-as-a-Service (SaaS) angeboten.
              </p>
              <p className="mt-2">
                Es werden verschiedene Abonnement-Pläne angeboten (Free, Family, FamilyPro).
                Der Funktionsumfang richtet sich nach dem gewählten Plan.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 3 Registrierung und Nutzerkonto</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Die Registrierung ist nur volljährigen Personen (ab 18 Jahren) gestattet.
                  Eltern erstellen Konten für ihre minderjährigen Kinder.
                </li>
                <li>
                  Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben
                  zu machen und diese aktuell zu halten.
                </li>
                <li>
                  Zugangsdaten (E-Mail und Passwort) sind vertraulich zu behandeln. Der Nutzer
                  ist für alle Aktivitäten unter seinem Konto verantwortlich.
                </li>
                <li>
                  Ein Konto ist nicht übertragbar.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 4 Abonnements und Zahlungsbedingungen</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Kostenpflichtige Abonnements werden monatlich oder jährlich abgerechnet und
                  verlängern sich automatisch, sofern nicht rechtzeitig gekündigt wird.
                </li>
                <li>
                  Die Zahlung erfolgt über Stripe. Es gelten die Zahlungsbedingungen von Stripe.
                </li>
                <li>
                  Preise sind inklusive der gesetzlichen Mehrwertsteuer, sofern nicht anders
                  angegeben.
                </li>
                <li>
                  Änderungen der Preise werden dem Nutzer mindestens 30 Tage vor Inkrafttreten
                  per E-Mail mitgeteilt.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 5 Widerrufsrecht</h2>
              <p>
                Verbraucher haben das Recht, binnen 14 Tagen ohne Angabe von Gründen den
                Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des
                Vertragsabschlusses.
              </p>
              <p className="mt-2">
                Um das Widerrufsrecht auszuüben, müssen Sie uns (Sonoa, Riewert Petersen,
                Warnstedtstr. 59a, 22525 Hamburg, E-Mail: info@herokids.app) mittels einer
                eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen,
                informieren.
              </p>
              <p className="mt-2">
                <strong>Hinweis:</strong> Das Widerrufsrecht erlischt bei digitalen Inhalten,
                wenn die Ausführung des Vertrags begonnen hat und der Verbraucher ausdrücklich
                zugestimmt hat, dass der Anbieter vor Ablauf der Widerrufsfrist mit der
                Ausführung beginnt.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 6 Kündigung</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Der Nutzer kann sein Konto jederzeit über die App-Einstellungen oder durch
                  Kontaktaufnahme per E-Mail kündigen.
                </li>
                <li>
                  Kostenpflichtige Abonnements können jederzeit zum Ende des aktuellen
                  Abrechnungszeitraums gekündigt werden.
                </li>
                <li>
                  Nach der Kündigung werden alle personenbezogenen Daten innerhalb von 30 Tagen
                  dauerhaft gelöscht.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 7 Nutzungspflichten</h2>
              <p>Der Nutzer verpflichtet sich:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>die App nur für den vorgesehenen Zweck (Familien-Aufgabenverwaltung) zu nutzen</li>
                <li>keine rechtswidrigen, beleidigenden oder schädlichen Inhalte hochzuladen</li>
                <li>keine Versuche zu unternehmen, die Sicherheit der Anwendung zu kompromittieren</li>
                <li>die App nicht kommerziell weiterzuvertreiben oder zu lizenzieren</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 8 Haftungsbeschränkung</h2>
              <p>
                HeroKids haftet nicht für Schäden, die durch höhere Gewalt, technische Ausfälle
                Dritter (z.B. Hosting-Anbieter) oder durch missbräuchliche Nutzung entstehen.
              </p>
              <p className="mt-2">
                Die Verfügbarkeit des Dienstes wird angestrebt, aber nicht garantiert. Geplante
                Wartungsarbeiten werden nach Möglichkeit angekündigt.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 9 Datenschutz</h2>
              <p>
                Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
                <a href="/privacy" className="underline font-medium">Datenschutzerklärung</a>,
                die Bestandteil dieser AGB ist.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 10 Änderungen der AGB</h2>
              <p>
                Wir behalten uns vor, diese AGB mit einer Ankündigungsfrist von mindestens
                30 Tagen zu ändern. Nutzer werden per E-Mail informiert. Widerspricht der
                Nutzer nicht innerhalb von 30 Tagen, gelten die neuen AGB als angenommen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 11 Anwendbares Recht und Gerichtsstand</h2>
              <p>
                Es gilt deutsches Recht. Gerichtsstand ist Hamburg, sofern der Nutzer Kaufmann
                ist oder keinen allgemeinen Gerichtsstand in Deutschland hat.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">§ 12 Schlussbestimmungen</h2>
              <p>
                Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt
                die Wirksamkeit der übrigen Bestimmungen davon unberührt.
              </p>
            </section>

            <div className="pt-6 border-t border-border text-xs text-muted-foreground">
              <p>Sonoa · Riewert Petersen · Warnstedtstr. 59a · 22525 Hamburg · info@herokids.app</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
