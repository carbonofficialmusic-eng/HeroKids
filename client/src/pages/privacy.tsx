import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Privacy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card data-testid="card-privacy-policy">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl" data-testid="title-privacy-policy">Privacy Policy / Datenschutzerklärung</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground" data-testid="text-last-updated">Last updated: January 2025</p>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h2>
              <p>
                HeroKids ("we", "our", or "us") is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, and safeguard your information 
                when you use our family task management application.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">2. Information We Collect</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">Account Information</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Name and email address (via Replit authentication)</li>
                <li>Profile picture (optional)</li>
                <li>Family member names and roles</li>
              </ul>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Usage Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Tasks created and completed</li>
                <li>Points earned and rewards redeemed</li>
                <li>App preferences and settings</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">Photos</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Task proof photos (when uploaded by users) — automatically deleted after 30 days</li>
                <li>Profile avatars (when uploaded)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and maintain the HeroKids service</li>
                <li>To manage your account and family membership</li>
                <li>To process task completions and rewards</li>
                <li>To send important service notifications</li>
                <li>To improve our application</li>
              </ul>
            </section>

            <section data-testid="section-data-storage">
              <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Storage and Security</h2>
              <p>
                Your data is stored securely using industry-standard encryption. 
                We use secure databases hosted on cloud infrastructure. 
                Photos are stored in encrypted cloud storage with access controls.
              </p>
            </section>

            <section data-testid="section-data-sharing">
              <h2 className="text-xl font-semibold mt-6 mb-3">5. Data Sharing</h2>
              <p>
                We do not sell, trade, or rent your personal information to third parties. 
                Data is only shared within your family group as part of the app's core functionality.
              </p>
              <p className="mt-2">
                We may share data with service providers who assist in operating our application:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Hosting and authentication provider</li>
                <li>Payment processing for subscriptions</li>
                <li>Cloud database hosting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">6. Children's Privacy</h2>
              <p>
                HeroKids is designed for family use, including children. 
                We collect minimal information from children and require parental consent 
                for account creation. Parents have full control over their children's data 
                and can delete it at any time through the app settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and all associated data</li>
                <li>Export your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">8. Data Retention</h2>
              <p>
                We retain your data as long as your account is active. 
                When you delete your account, all personal data is permanently removed 
                within 30 days.
              </p>
            </section>

            <section data-testid="section-cookies">
              <h2 className="text-xl font-semibold mt-6 mb-3">9. Cookies and Tracking</h2>
              <p>
                We use essential cookies only for authentication and session management. 
                We aim to minimize tracking and prioritize your privacy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">10. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or your data, 
                please contact us through the app's settings page.
              </p>
            </section>

            <hr className="my-8" />

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Datenschutzerklärung (Deutsch)</h2>
              
              <h3 className="text-lg font-medium mt-4 mb-2">1. Einleitung</h3>
              <p>
                HeroKids ("wir", "uns" oder "unser") verpflichtet sich, Ihre Privatsphäre zu schützen. 
                Diese Datenschutzerklärung erläutert, wie wir Ihre Informationen erfassen, 
                verwenden und schützen.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">2. Erhobene Daten</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Name und E-Mail-Adresse (über Replit-Authentifizierung)</li>
                <li>Profilbild (optional)</li>
                <li>Namen und Rollen der Familienmitglieder</li>
                <li>Erstellte und erledigte Aufgaben</li>
                <li>Verdiente Punkte und eingelöste Belohnungen</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">3. Verwendung der Daten</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Bereitstellung und Wartung des HeroKids-Dienstes</li>
                <li>Verwaltung Ihres Kontos und der Familienmitgliedschaft</li>
                <li>Verarbeitung von Aufgabenabschlüssen und Belohnungen</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">4. Datensicherheit</h3>
              <p>
                Ihre Daten werden mit branchenüblicher Verschlüsselung sicher gespeichert. 
                Wir verwenden sichere Datenbanken auf Cloud-Infrastruktur.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">5. Ihre Rechte (DSGVO)</h3>
              <p>Sie haben das Recht auf:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Auskunft über Ihre personenbezogenen Daten</li>
                <li>Berichtigung unrichtiger Daten</li>
                <li>Löschung Ihres Kontos und aller zugehörigen Daten</li>
                <li>Datenübertragbarkeit</li>
                <li>Widerruf der Einwilligung</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">6. Kontakt</h3>
              <p>
                Bei Fragen zu dieser Datenschutzerklärung oder Ihren Daten 
                kontaktieren Sie uns bitte über die Einstellungsseite der App.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
