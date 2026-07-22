import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Impressum() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Button variant="outline" asChild className="mb-8">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold font-accent mb-8">Impressum</h1>

        <section className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">Angaben gemäß § 5 TMG</h2>
            <p>Sonoa</p>
            <p>Riewert Petersen</p>
            <p>Warnstedtstr. 59a</p>
            <p>22525 Hamburg</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">Steuernummer</h2>
            <p>45 182 05191</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">Umsatzsteuer-Identifikationsnummer</h2>
            <p>DE274980308</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">Kontakt</h2>
            <p>E-Mail: <a href="mailto:noreply@littlechamps.net" className="text-foreground underline">noreply@littlechamps.net</a></p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
            <p>Riewert Petersen</p>
            <p>Warnstedtstr. 59a</p>
            <p>22525 Hamburg</p>
          </div>

          <div className="pt-4 border-t border-border">
            <h2 className="text-base font-semibold text-foreground mb-2">Haftungsausschluss</h2>
            <p>
              Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
