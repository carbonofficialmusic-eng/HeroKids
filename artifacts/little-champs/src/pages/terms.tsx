import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface TermsSection {
  heading: string;
  content: React.ReactNode;
}

interface TermsContent {
  title: string;
  date: string;
  sections: TermsSection[];
  footer: string;
}

const CONTACT = {
  name: "Sonoa · Riewert Petersen",
  address: "Warnstedtstr. 59a · 22525 Hamburg",
  email: "info@littlechamps.net",
};

function emailLink() {
  return (
    <a href={`mailto:${CONTACT.email}`} className="underline">
      {CONTACT.email}
    </a>
  );
}

const termsContent: Record<string, TermsContent> = {
  de: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    date: "Stand: Juni 2026",
    sections: [
      {
        heading: "§ 1 Geltungsbereich",
        content: (
          <>
            <p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der webbasierten Anwendung <strong>Little Champs</strong>, betrieben von:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />E-Mail: {emailLink()}</p>
            <p className="mt-2">Mit der Registrierung eines Kontos erklärt sich der Nutzer mit diesen AGB einverstanden.</p>
          </>
        ),
      },
      {
        heading: "§ 2 Leistungsbeschreibung",
        content: (
          <>
            <p>Little Champs ist eine Familien-Aufgabenverwaltungs-App, die Kindern durch Gamification-Elemente (Punkte, Belohnungen, Leaderboards) dabei hilft, Haushaltsaufgaben zu erledigen. Die App richtet sich an Familien mit Kindern und wird als Software-as-a-Service (SaaS) angeboten.</p>
            <p className="mt-2">Es werden verschiedene Abonnement-Pläne angeboten (Free, Family, FamilyPro). Der Funktionsumfang richtet sich nach dem gewählten Plan.</p>
          </>
        ),
      },
      {
        heading: "§ 3 Registrierung und Nutzerkonto",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Die Registrierung ist nur volljährigen Personen (ab 18 Jahren) gestattet. Eltern erstellen Konten für ihre minderjährigen Kinder.</li>
            <li>Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und diese aktuell zu halten.</li>
            <li>Zugangsdaten (E-Mail und Passwort) sind vertraulich zu behandeln. Der Nutzer ist für alle Aktivitäten unter seinem Konto verantwortlich.</li>
            <li>Ein Konto ist nicht übertragbar.</li>
          </ul>
        ),
      },
      {
        heading: "§ 4 Abonnements und Zahlungsbedingungen",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Kostenpflichtige Abonnements werden monatlich oder jährlich abgerechnet und verlängern sich automatisch, sofern nicht rechtzeitig gekündigt wird.</li>
            <li>Die Zahlung erfolgt über Stripe oder den Apple App Store. Es gelten die jeweiligen Zahlungsbedingungen.</li>
            <li>Preise sind inklusive der gesetzlichen Mehrwertsteuer, sofern nicht anders angegeben.</li>
            <li>Änderungen der Preise werden dem Nutzer mindestens 30 Tage vor Inkrafttreten per E-Mail mitgeteilt.</li>
          </ul>
        ),
      },
      {
        heading: "§ 5 Widerrufsrecht",
        content: (
          <>
            <p>Verbraucher haben das Recht, binnen 14 Tagen ohne Angabe von Gründen den Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.</p>
            <p className="mt-2">Um das Widerrufsrecht auszuüben, müssen Sie uns ({CONTACT.name}, {CONTACT.address}, E-Mail: {emailLink()}) mittels einer eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>
            <p className="mt-2"><strong>Hinweis:</strong> Das Widerrufsrecht erlischt bei digitalen Inhalten, wenn die Ausführung des Vertrags begonnen hat und der Verbraucher ausdrücklich zugestimmt hat, dass der Anbieter vor Ablauf der Widerrufsfrist mit der Ausführung beginnt.</p>
          </>
        ),
      },
      {
        heading: "§ 6 Kündigung",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Der Nutzer kann sein Konto jederzeit über die App-Einstellungen oder durch Kontaktaufnahme per E-Mail kündigen.</li>
            <li>Kostenpflichtige Abonnements können jederzeit zum Ende des aktuellen Abrechnungszeitraums gekündigt werden.</li>
            <li>Nach der Kündigung werden alle personenbezogenen Daten innerhalb von 30 Tagen dauerhaft gelöscht.</li>
          </ul>
        ),
      },
      {
        heading: "§ 7 Nutzungspflichten",
        content: (
          <>
            <p>Der Nutzer verpflichtet sich:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>die App nur für den vorgesehenen Zweck (Familien-Aufgabenverwaltung) zu nutzen</li>
              <li>keine rechtswidrigen, beleidigenden oder schädlichen Inhalte hochzuladen</li>
              <li>keine Versuche zu unternehmen, die Sicherheit der Anwendung zu kompromittieren</li>
              <li>die App nicht kommerziell weiterzuvertreiben oder zu lizenzieren</li>
            </ul>
          </>
        ),
      },
      {
        heading: "§ 8 Haftungsbeschränkung",
        content: (
          <>
            <p>Little Champs haftet nicht für Schäden, die durch höhere Gewalt, technische Ausfälle Dritter (z.B. Hosting-Anbieter) oder durch missbräuchliche Nutzung entstehen.</p>
            <p className="mt-2">Die Verfügbarkeit des Dienstes wird angestrebt, aber nicht garantiert. Geplante Wartungsarbeiten werden nach Möglichkeit angekündigt.</p>
          </>
        ),
      },
      {
        heading: "§ 9 Datenschutz",
        content: <p>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer <a href="/privacy" className="underline font-medium">Datenschutzerklärung</a>, die Bestandteil dieser AGB ist.</p>,
      },
      {
        heading: "§ 10 Änderungen der AGB",
        content: <p>Wir behalten uns vor, diese AGB mit einer Ankündigungsfrist von mindestens 30 Tagen zu ändern. Nutzer werden per E-Mail informiert. Widerspricht der Nutzer nicht innerhalb von 30 Tagen, gelten die neuen AGB als angenommen.</p>,
      },
      {
        heading: "§ 11 Anwendbares Recht und Gerichtsstand",
        content: <p>Es gilt deutsches Recht. Gerichtsstand ist Hamburg, sofern der Nutzer Kaufmann ist oder keinen allgemeinen Gerichtsstand in Deutschland hat.</p>,
      },
      {
        heading: "§ 12 Schlussbestimmungen",
        content: <p>Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  en: {
    title: "Terms of Use (EULA)",
    date: "Last updated: June 2026",
    sections: [
      {
        heading: "1. Scope",
        content: (
          <>
            <p>These Terms of Use govern the use of the web-based application <strong>Little Champs</strong>, operated by:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />Email: {emailLink()}</p>
            <p className="mt-2">By creating an account, the user agrees to these Terms of Use.</p>
          </>
        ),
      },
      {
        heading: "2. Service Description",
        content: (
          <>
            <p>Little Champs is a family task management app that helps children complete household chores through gamification elements (points, rewards, leaderboards). The app is designed for families with children and is offered as Software-as-a-Service (SaaS).</p>
            <p className="mt-2">Various subscription plans are available (Free, Family, FamilyPro). The scope of features depends on the selected plan.</p>
          </>
        ),
      },
      {
        heading: "3. Registration and User Account",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Registration is only permitted for adults (18 years or older). Parents create accounts for their minor children.</li>
            <li>The user is obligated to provide accurate information upon registration and keep it up to date.</li>
            <li>Login credentials (email and password) must be kept confidential. The user is responsible for all activities under their account.</li>
            <li>An account is non-transferable.</li>
          </ul>
        ),
      },
      {
        heading: "4. Subscriptions and Payment Terms",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Paid subscriptions are billed monthly or annually and renew automatically unless cancelled in time.</li>
            <li>Payment is processed via Stripe or the Apple App Store. The respective payment terms apply.</li>
            <li>Prices include applicable taxes unless otherwise stated.</li>
            <li>Price changes will be communicated to the user at least 30 days before taking effect.</li>
          </ul>
        ),
      },
      {
        heading: "5. Right of Withdrawal",
        content: (
          <>
            <p>Consumers have the right to withdraw from the contract within 14 days without stating reasons. The withdrawal period is 14 days from the date of conclusion of the contract.</p>
            <p className="mt-2">To exercise the right of withdrawal, you must inform us ({CONTACT.name}, {CONTACT.address}, Email: {emailLink()}) of your decision to withdraw from this contract by means of a clear statement.</p>
            <p className="mt-2"><strong>Note:</strong> The right of withdrawal expires for digital content once performance has begun and the consumer has expressly agreed that the provider may begin performance before the withdrawal period has expired.</p>
          </>
        ),
      },
      {
        heading: "6. Cancellation",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>The user may cancel their account at any time through the app settings or by contacting us by email.</li>
            <li>Paid subscriptions may be cancelled at any time, effective at the end of the current billing period.</li>
            <li>After cancellation, all personal data will be permanently deleted within 30 days.</li>
          </ul>
        ),
      },
      {
        heading: "7. User Obligations",
        content: (
          <>
            <p>The user agrees to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>use the app only for its intended purpose (family task management)</li>
              <li>not upload unlawful, offensive, or harmful content</li>
              <li>not attempt to compromise the security of the application</li>
              <li>not commercially resell or sublicense the app</li>
            </ul>
          </>
        ),
      },
      {
        heading: "8. Limitation of Liability",
        content: (
          <>
            <p>Little Champs is not liable for damages caused by force majeure, technical failures of third parties (e.g. hosting providers), or misuse.</p>
            <p className="mt-2">Service availability is aimed for but not guaranteed. Planned maintenance will be announced where possible.</p>
          </>
        ),
      },
      {
        heading: "9. Privacy",
        content: <p>The processing of personal data is governed by our <a href="/privacy" className="underline font-medium">Privacy Policy</a>, which forms part of these Terms of Use.</p>,
      },
      {
        heading: "10. Changes to These Terms",
        content: <p>We reserve the right to amend these Terms with at least 30 days' notice. Users will be informed by email. If the user does not object within 30 days, the new Terms are deemed accepted.</p>,
      },
      {
        heading: "11. Governing Law and Jurisdiction",
        content: <p>German law applies. The place of jurisdiction is Hamburg, provided the user is a merchant or has no general place of jurisdiction in Germany.</p>,
      },
      {
        heading: "12. Severability",
        content: <p>Should any provision of these Terms be or become invalid, the validity of the remaining provisions shall not be affected.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  es: {
    title: "Términos de Uso (CLUF)",
    date: "Última actualización: junio de 2026",
    sections: [
      {
        heading: "1. Ámbito de aplicación",
        content: (
          <>
            <p>Estos Términos de Uso rigen el uso de la aplicación web <strong>Little Champs</strong>, operada por:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />Correo: {emailLink()}</p>
            <p className="mt-2">Al crear una cuenta, el usuario acepta estos Términos de Uso.</p>
          </>
        ),
      },
      {
        heading: "2. Descripción del servicio",
        content: (
          <>
            <p>Little Champs es una aplicación de gestión de tareas familiares que ayuda a los niños a completar las tareas del hogar mediante elementos de gamificación (puntos, recompensas, clasificaciones). La aplicación está diseñada para familias con hijos y se ofrece como Software como Servicio (SaaS).</p>
            <p className="mt-2">Hay varios planes de suscripción disponibles (Free, Family, FamilyPro). El alcance de las funciones depende del plan seleccionado.</p>
          </>
        ),
      },
      {
        heading: "3. Registro y cuenta de usuario",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>El registro solo está permitido para adultos (18 años o más). Los padres crean cuentas para sus hijos menores de edad.</li>
            <li>El usuario está obligado a proporcionar información veraz al registrarse y mantenerla actualizada.</li>
            <li>Las credenciales de acceso deben mantenerse confidenciales. El usuario es responsable de todas las actividades realizadas bajo su cuenta.</li>
            <li>Una cuenta no es transferible.</li>
          </ul>
        ),
      },
      {
        heading: "4. Suscripciones y condiciones de pago",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Las suscripciones de pago se facturan mensual o anualmente y se renuevan automáticamente a menos que se cancelen a tiempo.</li>
            <li>El pago se procesa a través de Stripe o la App Store de Apple. Se aplican los respectivos términos de pago.</li>
            <li>Los precios incluyen los impuestos aplicables salvo indicación contraria.</li>
            <li>Los cambios de precios se comunicarán al usuario con al menos 30 días de antelación.</li>
          </ul>
        ),
      },
      {
        heading: "5. Derecho de desistimiento",
        content: (
          <>
            <p>Los consumidores tienen derecho a desistir del contrato en un plazo de 14 días sin indicar motivos. El plazo de desistimiento es de 14 días a partir de la fecha de celebración del contrato.</p>
            <p className="mt-2">Para ejercer el derecho de desistimiento, deberá informarnos ({CONTACT.name}, {CONTACT.address}, Correo: {emailLink()}) de su decisión mediante una declaración inequívoca.</p>
            <p className="mt-2"><strong>Nota:</strong> El derecho de desistimiento expira para el contenido digital una vez que ha comenzado la ejecución y el consumidor ha dado su consentimiento expreso.</p>
          </>
        ),
      },
      {
        heading: "6. Cancelación",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>El usuario puede cancelar su cuenta en cualquier momento a través de la configuración de la aplicación o contactándonos por correo electrónico.</li>
            <li>Las suscripciones de pago pueden cancelarse en cualquier momento, con efecto al final del período de facturación actual.</li>
            <li>Tras la cancelación, todos los datos personales se eliminarán permanentemente en un plazo de 30 días.</li>
          </ul>
        ),
      },
      {
        heading: "7. Obligaciones del usuario",
        content: (
          <>
            <p>El usuario se compromete a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>usar la aplicación únicamente para su fin previsto (gestión de tareas familiares)</li>
              <li>no cargar contenido ilegal, ofensivo o perjudicial</li>
              <li>no intentar comprometer la seguridad de la aplicación</li>
              <li>no revender ni sublicenciar la aplicación con fines comerciales</li>
            </ul>
          </>
        ),
      },
      {
        heading: "8. Limitación de responsabilidad",
        content: (
          <>
            <p>Little Champs no es responsable de los daños causados por fuerza mayor, fallos técnicos de terceros o uso indebido.</p>
            <p className="mt-2">Se busca la disponibilidad del servicio, pero no se garantiza. El mantenimiento planificado se anunciará cuando sea posible.</p>
          </>
        ),
      },
      {
        heading: "9. Privacidad",
        content: <p>El tratamiento de datos personales se rige por nuestra <a href="/privacy" className="underline font-medium">Política de Privacidad</a>, que forma parte de estos Términos de Uso.</p>,
      },
      {
        heading: "10. Modificaciones",
        content: <p>Nos reservamos el derecho a modificar estos Términos con un preaviso mínimo de 30 días. Los usuarios serán informados por correo electrónico. Si el usuario no se opone en 30 días, se consideran aceptados los nuevos Términos.</p>,
      },
      {
        heading: "11. Ley aplicable y jurisdicción",
        content: <p>Se aplica la legislación alemana. El lugar de jurisdicción es Hamburgo, siempre que el usuario sea comerciante o no tenga domicilio general en Alemania.</p>,
      },
      {
        heading: "12. Disposiciones finales",
        content: <p>Si alguna disposición de estos Términos fuera inválida, la validez de las demás disposiciones no se verá afectada.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  fr: {
    title: "Conditions d'utilisation (CLUF)",
    date: "Dernière mise à jour : juin 2026",
    sections: [
      {
        heading: "1. Champ d'application",
        content: (
          <>
            <p>Les présentes Conditions d'utilisation régissent l'utilisation de l'application web <strong>Little Champs</strong>, exploitée par :</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />E-mail : {emailLink()}</p>
            <p className="mt-2">En créant un compte, l'utilisateur accepte les présentes Conditions d'utilisation.</p>
          </>
        ),
      },
      {
        heading: "2. Description du service",
        content: (
          <>
            <p>Little Champs est une application de gestion des tâches familiales qui aide les enfants à accomplir les tâches ménagères grâce à des éléments de gamification (points, récompenses, classements). L'application est destinée aux familles avec enfants et est proposée en tant que logiciel en tant que service (SaaS).</p>
            <p className="mt-2">Différents plans d'abonnement sont disponibles (Free, Family, FamilyPro). L'étendue des fonctionnalités dépend du plan choisi.</p>
          </>
        ),
      },
      {
        heading: "3. Inscription et compte utilisateur",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>L'inscription est réservée aux personnes majeures (18 ans ou plus). Les parents créent des comptes pour leurs enfants mineurs.</li>
            <li>L'utilisateur est tenu de fournir des informations exactes lors de l'inscription et de les maintenir à jour.</li>
            <li>Les identifiants de connexion doivent être gardés confidentiels. L'utilisateur est responsable de toutes les activités effectuées sous son compte.</li>
            <li>Un compte est non transférable.</li>
          </ul>
        ),
      },
      {
        heading: "4. Abonnements et conditions de paiement",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Les abonnements payants sont facturés mensuellement ou annuellement et se renouvellent automatiquement sauf résiliation dans les délais.</li>
            <li>Le paiement est traité via Stripe ou l'App Store d'Apple. Les conditions de paiement respectives s'appliquent.</li>
            <li>Les prix incluent les taxes applicables sauf indication contraire.</li>
            <li>Les modifications de tarifs seront communiquées à l'utilisateur au moins 30 jours avant leur entrée en vigueur.</li>
          </ul>
        ),
      },
      {
        heading: "5. Droit de rétractation",
        content: (
          <>
            <p>Les consommateurs ont le droit de se rétracter du contrat dans un délai de 14 jours sans en indiquer les raisons. Le délai de rétractation est de 14 jours à compter de la date de conclusion du contrat.</p>
            <p className="mt-2">Pour exercer le droit de rétractation, vous devez nous informer ({CONTACT.name}, {CONTACT.address}, E-mail : {emailLink()}) de votre décision par une déclaration non équivoque.</p>
            <p className="mt-2"><strong>Remarque :</strong> Le droit de rétractation expire pour le contenu numérique une fois l'exécution commencée et après consentement exprès du consommateur.</p>
          </>
        ),
      },
      {
        heading: "6. Résiliation",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>L'utilisateur peut résilier son compte à tout moment via les paramètres de l'application ou en nous contactant par e-mail.</li>
            <li>Les abonnements payants peuvent être résiliés à tout moment, avec effet à la fin de la période de facturation en cours.</li>
            <li>Après résiliation, toutes les données personnelles seront définitivement supprimées dans un délai de 30 jours.</li>
          </ul>
        ),
      },
      {
        heading: "7. Obligations de l'utilisateur",
        content: (
          <>
            <p>L'utilisateur s'engage à :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>utiliser l'application uniquement à des fins prévues (gestion des tâches familiales)</li>
              <li>ne pas télécharger de contenu illégal, offensant ou nuisible</li>
              <li>ne pas tenter de compromettre la sécurité de l'application</li>
              <li>ne pas revendre ou sous-licencier l'application à des fins commerciales</li>
            </ul>
          </>
        ),
      },
      {
        heading: "8. Limitation de responsabilité",
        content: (
          <>
            <p>Little Champs n'est pas responsable des dommages causés par un cas de force majeure, des défaillances techniques de tiers ou une utilisation abusive.</p>
            <p className="mt-2">La disponibilité du service est recherchée mais non garantie. La maintenance planifiée sera annoncée dans la mesure du possible.</p>
          </>
        ),
      },
      {
        heading: "9. Confidentialité",
        content: <p>Le traitement des données personnelles est régi par notre <a href="/privacy" className="underline font-medium">Politique de confidentialité</a>, qui fait partie des présentes Conditions d'utilisation.</p>,
      },
      {
        heading: "10. Modifications",
        content: <p>Nous nous réservons le droit de modifier les présentes Conditions avec un préavis d'au moins 30 jours. Les utilisateurs seront informés par e-mail. Si l'utilisateur ne s'y oppose pas dans les 30 jours, les nouvelles Conditions sont réputées acceptées.</p>,
      },
      {
        heading: "11. Droit applicable et juridiction compétente",
        content: <p>Le droit allemand s'applique. Le lieu de juridiction est Hambourg, dans la mesure où l'utilisateur est un commerçant ou n'a pas de domicile général en Allemagne.</p>,
      },
      {
        heading: "12. Dispositions finales",
        content: <p>Si une disposition des présentes Conditions est ou devient invalide, la validité des autres dispositions n'en sera pas affectée.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  sv: {
    title: "Användarvillkor (EULA)",
    date: "Senast uppdaterad: juni 2026",
    sections: [
      {
        heading: "1. Tillämpningsområde",
        content: (
          <>
            <p>Dessa Användarvillkor gäller för användningen av webbapplikationen <strong>Little Champs</strong>, som drivs av:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />E-post: {emailLink()}</p>
            <p className="mt-2">Genom att skapa ett konto godkänner användaren dessa Användarvillkor.</p>
          </>
        ),
      },
      {
        heading: "2. Tjänstebeskrivning",
        content: (
          <>
            <p>Little Champs är en uppgiftshanteringsapp för familjer som hjälper barn att genomföra hushållssysslor med hjälp av spelifiering (poäng, belöningar, topplistor). Appen är utformad för familjer med barn och erbjuds som programvara som tjänst (SaaS).</p>
            <p className="mt-2">Olika prenumerationsplaner finns tillgängliga (Free, Family, FamilyPro). Funktionsomfånget beror på vald plan.</p>
          </>
        ),
      },
      {
        heading: "3. Registrering och användarkonto",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Registrering är endast tillåten för vuxna (18 år eller äldre). Föräldrar skapar konton för sina minderåriga barn.</li>
            <li>Användaren är skyldig att ange korrekt information vid registrering och hålla den uppdaterad.</li>
            <li>Inloggningsuppgifter ska hållas konfidentiella. Användaren ansvarar för all aktivitet under sitt konto.</li>
            <li>Ett konto är inte överlåtbart.</li>
          </ul>
        ),
      },
      {
        heading: "4. Prenumerationer och betalningsvillkor",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Betalda prenumerationer faktureras månadsvis eller årsvis och förnyas automatiskt om de inte sägs upp i tid.</li>
            <li>Betalning sker via Stripe eller Apple App Store. Respektive betalningsvillkor gäller.</li>
            <li>Priser inkluderar tillämpliga skatter om inget annat anges.</li>
            <li>Prisändringar meddelas användaren minst 30 dagar innan de träder i kraft.</li>
          </ul>
        ),
      },
      {
        heading: "5. Ångerrätt",
        content: (
          <>
            <p>Konsumenter har rätt att frånträda avtalet inom 14 dagar utan att ange skäl. Ångerfristen är 14 dagar från avtalets ingående.</p>
            <p className="mt-2">För att utöva ångerrätten måste du informera oss ({CONTACT.name}, {CONTACT.address}, E-post: {emailLink()}) om ditt beslut att frånträda avtalet.</p>
            <p className="mt-2"><strong>Obs:</strong> Ångerrätten upphör för digitalt innehåll när leveransen påbörjats och konsumenten uttryckligen godkänt detta.</p>
          </>
        ),
      },
      {
        heading: "6. Uppsägning",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>Användaren kan när som helst avsluta sitt konto via appinställningarna eller via e-post.</li>
            <li>Betalda prenumerationer kan sägas upp när som helst, med verkan vid slutet av aktuell faktureringsperiod.</li>
            <li>Efter uppsägning raderas all personlig data permanent inom 30 dagar.</li>
          </ul>
        ),
      },
      {
        heading: "7. Användarens skyldigheter",
        content: (
          <>
            <p>Användaren förbinder sig att:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>använda appen enbart för avsett syfte (familjeuppgiftshantering)</li>
              <li>inte ladda upp olagligt, stötande eller skadligt innehåll</li>
              <li>inte försöka äventyra applikationens säkerhet</li>
              <li>inte sälja vidare eller underlicensiera appen i kommersiellt syfte</li>
            </ul>
          </>
        ),
      },
      {
        heading: "8. Ansvarsbegränsning",
        content: (
          <>
            <p>Little Champs ansvarar inte för skador orsakade av force majeure, tekniska fel hos tredje part eller missbruk.</p>
            <p className="mt-2">Tjänstens tillgänglighet eftersträvas men garanteras inte. Planerat underhåll meddelas när möjligt.</p>
          </>
        ),
      },
      {
        heading: "9. Integritet",
        content: <p>Behandling av personuppgifter regleras av vår <a href="/privacy" className="underline font-medium">Integritetspolicy</a>, som utgör en del av dessa Användarvillkor.</p>,
      },
      {
        heading: "10. Ändringar",
        content: <p>Vi förbehåller oss rätten att ändra dessa Villkor med minst 30 dagars varsel. Användare informeras via e-post. Om användaren inte invänder inom 30 dagar anses de nya Villkoren accepterade.</p>,
      },
      {
        heading: "11. Tillämplig lag och jurisdiktion",
        content: <p>Tysk lag tillämpas. Jurisdiktionsort är Hamburg, förutsatt att användaren är näringsidkare eller saknar allmänt hemvist i Tyskland.</p>,
      },
      {
        heading: "12. Slutbestämmelser",
        content: <p>Om någon bestämmelse i dessa Villkor är eller blir ogiltig påverkas inte övriga bestämmelsers giltighet.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  pt: {
    title: "Termos de Uso (EULA)",
    date: "Última atualização: junho de 2026",
    sections: [
      {
        heading: "1. Âmbito de aplicação",
        content: (
          <>
            <p>Estes Termos de Uso regem o uso do aplicativo web <strong>Little Champs</strong>, operado por:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />E-mail: {emailLink()}</p>
            <p className="mt-2">Ao criar uma conta, o utilizador aceita estes Termos de Uso.</p>
          </>
        ),
      },
      {
        heading: "2. Descrição do serviço",
        content: (
          <>
            <p>Little Champs é um aplicativo de gestão de tarefas familiares que ajuda crianças a realizar tarefas domésticas através de elementos de gamificação (pontos, recompensas, classificações). O aplicativo é destinado a famílias com filhos e é oferecido como Software como Serviço (SaaS).</p>
            <p className="mt-2">Estão disponíveis vários planos de subscrição (Free, Family, FamilyPro). O âmbito das funcionalidades depende do plano selecionado.</p>
          </>
        ),
      },
      {
        heading: "3. Registo e conta de utilizador",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>O registo só é permitido a adultos (18 anos ou mais). Os pais criam contas para os seus filhos menores.</li>
            <li>O utilizador é obrigado a fornecer informações corretas no registo e mantê-las atualizadas.</li>
            <li>As credenciais de acesso devem ser mantidas confidenciais. O utilizador é responsável por todas as atividades realizadas com a sua conta.</li>
            <li>Uma conta não é transferível.</li>
          </ul>
        ),
      },
      {
        heading: "4. Subscrições e condições de pagamento",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>As subscrições pagas são faturadas mensalmente ou anualmente e renovam-se automaticamente salvo cancelamento atempado.</li>
            <li>O pagamento é processado através da Stripe ou da App Store da Apple. Aplicam-se os respetivos termos de pagamento.</li>
            <li>Os preços incluem impostos aplicáveis salvo indicação em contrário.</li>
            <li>As alterações de preços serão comunicadas ao utilizador com pelo menos 30 dias de antecedência.</li>
          </ul>
        ),
      },
      {
        heading: "5. Direito de rescisão",
        content: (
          <>
            <p>Os consumidores têm o direito de rescindir o contrato no prazo de 14 dias sem indicar motivos. O prazo de rescisão é de 14 dias a contar da data de celebração do contrato.</p>
            <p className="mt-2">Para exercer o direito de rescisão, deve informar-nos ({CONTACT.name}, {CONTACT.address}, E-mail: {emailLink()}) da sua decisão por meio de uma declaração inequívoca.</p>
            <p className="mt-2"><strong>Nota:</strong> O direito de rescisão expira para conteúdo digital uma vez iniciada a execução e após o consentimento expresso do consumidor.</p>
          </>
        ),
      },
      {
        heading: "6. Cancelamento",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>O utilizador pode cancelar a sua conta a qualquer momento através das definições do aplicativo ou por e-mail.</li>
            <li>As subscrições pagas podem ser canceladas a qualquer momento, com efeito no final do período de faturação atual.</li>
            <li>Após o cancelamento, todos os dados pessoais serão eliminados permanentemente no prazo de 30 dias.</li>
          </ul>
        ),
      },
      {
        heading: "7. Obrigações do utilizador",
        content: (
          <>
            <p>O utilizador compromete-se a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>usar o aplicativo apenas para o fim previsto (gestão de tarefas familiares)</li>
              <li>não carregar conteúdo ilegal, ofensivo ou prejudicial</li>
              <li>não tentar comprometer a segurança do aplicativo</li>
              <li>não revender nem sublicenciar o aplicativo para fins comerciais</li>
            </ul>
          </>
        ),
      },
      {
        heading: "8. Limitação de responsabilidade",
        content: (
          <>
            <p>Little Champs não se responsabiliza por danos causados por força maior, falhas técnicas de terceiros ou uso indevido.</p>
            <p className="mt-2">A disponibilidade do serviço é pretendida mas não garantida. A manutenção planeada será anunciada quando possível.</p>
          </>
        ),
      },
      {
        heading: "9. Privacidade",
        content: <p>O tratamento de dados pessoais é regido pela nossa <a href="/privacy" className="underline font-medium">Política de Privacidade</a>, que faz parte destes Termos de Uso.</p>,
      },
      {
        heading: "10. Alterações",
        content: <p>Reservamo-nos o direito de alterar estes Termos com um aviso prévio de pelo menos 30 dias. Os utilizadores serão informados por e-mail. Se o utilizador não se opuser no prazo de 30 dias, os novos Termos são considerados aceites.</p>,
      },
      {
        heading: "11. Lei aplicável e jurisdição",
        content: <p>Aplica-se a lei alemã. O foro competente é Hamburgo, desde que o utilizador seja comerciante ou não tenha domicílio geral na Alemanha.</p>,
      },
      {
        heading: "12. Disposições finais",
        content: <p>Se alguma disposição destes Termos for ou se tornar inválida, a validade das restantes disposições não será afetada.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  ja: {
    title: "利用規約（EULA）",
    date: "最終更新：2026年6月",
    sections: [
      {
        heading: "第1条　適用範囲",
        content: (
          <>
            <p>本利用規約は、以下が運営するウェブアプリケーション<strong>Little Champs</strong>の利用に適用されます：</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />メール：{emailLink()}</p>
            <p className="mt-2">アカウントを作成することにより、ユーザーはこれらの利用規約に同意したものとみなされます。</p>
          </>
        ),
      },
      {
        heading: "第2条　サービスの説明",
        content: (
          <>
            <p>Little Champsは、ゲーミフィケーション要素（ポイント、報酬、ランキング）を通じて子どもたちが家事を行えるよう支援する家族向けタスク管理アプリです。子どもを持つ家族を対象とし、SaaS（サービスとしてのソフトウェア）として提供されます。</p>
            <p className="mt-2">複数のサブスクリプションプランをご用意しています（Free・Family・FamilyPro）。機能の範囲は選択したプランによって異なります。</p>
          </>
        ),
      },
      {
        heading: "第3条　登録とユーザーアカウント",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>登録は18歳以上の成人のみに許可されています。保護者が未成年の子どものアカウントを作成します。</li>
            <li>ユーザーは登録時に正確な情報を提供し、常に最新の状態に保つ義務があります。</li>
            <li>ログイン情報は機密として扱う必要があります。ユーザーはアカウントで行われるすべての活動に責任を負います。</li>
            <li>アカウントは譲渡不可です。</li>
          </ul>
        ),
      },
      {
        heading: "第4条　サブスクリプションおよび支払い条件",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>有料サブスクリプションは月次または年次で請求され、適時にキャンセルされない限り自動的に更新されます。</li>
            <li>支払いはStripeまたはApple App Storeを通じて処理されます。各支払い条件が適用されます。</li>
            <li>特別な記載がない限り、価格には適用税が含まれます。</li>
            <li>価格変更は、発効の少なくとも30日前にユーザーにメールでお知らせします。</li>
          </ul>
        ),
      },
      {
        heading: "第5条　クーリングオフ権",
        content: (
          <>
            <p>消費者は、理由を示さずに14日以内に契約を撤回する権利があります。撤回期間は契約締結日から14日間です。</p>
            <p className="mt-2">撤回権を行使するには、({CONTACT.name}、{CONTACT.address}、メール：{emailLink()})に対し、契約から撤回する旨の明確な声明により通知してください。</p>
            <p className="mt-2"><strong>注意：</strong>デジタルコンテンツの撤回権は、履行が開始され、消費者が期間満了前の履行開始に明示的に同意した場合に消滅します。</p>
          </>
        ),
      },
      {
        heading: "第6条　解約",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>ユーザーはいつでもアプリの設定またはメールでアカウントを解約できます。</li>
            <li>有料サブスクリプションはいつでもキャンセルでき、現在の請求期間の終了時に効力を生じます。</li>
            <li>解約後、すべての個人データは30日以内に完全に削除されます。</li>
          </ul>
        ),
      },
      {
        heading: "第7条　ユーザーの義務",
        content: (
          <>
            <p>ユーザーは以下に同意します：</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>アプリを目的（家族のタスク管理）にのみ使用すること</li>
              <li>違法、攻撃的、有害なコンテンツをアップロードしないこと</li>
              <li>アプリケーションのセキュリティを侵害しようとしないこと</li>
              <li>商業目的でアプリを再販またはサブライセンスしないこと</li>
            </ul>
          </>
        ),
      },
      {
        heading: "第8条　責任の制限",
        content: (
          <>
            <p>Little Champsは、不可抗力、第三者の技術的障害、または不正使用によって生じた損害について責任を負いません。</p>
            <p className="mt-2">サービスの可用性を目指していますが、保証するものではありません。計画的なメンテナンスは可能な限り事前にお知らせします。</p>
          </>
        ),
      },
      {
        heading: "第9条　プライバシー",
        content: <p>個人データの処理は、本利用規約の一部を構成する<a href="/privacy" className="underline font-medium">プライバシーポリシー</a>に従います。</p>,
      },
      {
        heading: "第10条　規約の変更",
        content: <p>少なくとも30日前の予告をもって本規約を変更する権利を留保します。ユーザーにはメールで通知されます。ユーザーが30日以内に異議を申し立てない場合、新規約に同意したものとみなされます。</p>,
      },
      {
        heading: "第11条　準拠法および管轄裁判所",
        content: <p>ドイツ法が適用されます。ユーザーが商人である場合、またはドイツに一般的な裁判籍を有しない場合、管轄裁判所はハンブルクとなります。</p>,
      },
      {
        heading: "第12条　最終条項",
        content: <p>本規約のいずれかの条項が無効または無効となった場合でも、その他の条項の有効性は影響を受けません。</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  ko: {
    title: "이용 약관 (EULA)",
    date: "최종 업데이트: 2026년 6월",
    sections: [
      {
        heading: "제1조 적용 범위",
        content: (
          <>
            <p>본 이용 약관은 다음이 운영하는 웹 애플리케이션 <strong>Little Champs</strong>의 이용에 적용됩니다:</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />이메일: {emailLink()}</p>
            <p className="mt-2">계정을 생성함으로써 사용자는 본 이용 약관에 동의한 것으로 간주됩니다.</p>
          </>
        ),
      },
      {
        heading: "제2조 서비스 설명",
        content: (
          <>
            <p>Little Champs는 게임화 요소(포인트, 보상, 리더보드)를 통해 어린이가 집안일을 완료하도록 돕는 가족 작업 관리 앱입니다. 이 앱은 자녀가 있는 가족을 위해 설계되었으며 서비스형 소프트웨어(SaaS)로 제공됩니다.</p>
            <p className="mt-2">다양한 구독 플랜(Free, Family, FamilyPro)이 제공됩니다. 기능 범위는 선택한 플랜에 따라 다릅니다.</p>
          </>
        ),
      },
      {
        heading: "제3조 가입 및 사용자 계정",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>가입은 성인(18세 이상)에게만 허용됩니다. 부모가 미성년 자녀의 계정을 생성합니다.</li>
            <li>사용자는 가입 시 정확한 정보를 제공하고 최신 상태로 유지할 의무가 있습니다.</li>
            <li>로그인 정보는 기밀로 유지해야 합니다. 사용자는 자신의 계정 하에 이루어지는 모든 활동에 책임을 집니다.</li>
            <li>계정은 양도할 수 없습니다.</li>
          </ul>
        ),
      },
      {
        heading: "제4조 구독 및 결제 조건",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>유료 구독은 월별 또는 연별로 청구되며, 제때 취소하지 않으면 자동으로 갱신됩니다.</li>
            <li>결제는 Stripe 또는 Apple App Store를 통해 처리됩니다. 각각의 결제 조건이 적용됩니다.</li>
            <li>달리 명시되지 않는 한 가격에는 적용 세금이 포함됩니다.</li>
            <li>가격 변경은 발효 최소 30일 전에 이메일로 사용자에게 통보됩니다.</li>
          </ul>
        ),
      },
      {
        heading: "제5조 철회권",
        content: (
          <>
            <p>소비자는 이유를 명시하지 않고 14일 이내에 계약을 철회할 권리가 있습니다. 철회 기간은 계약 체결일로부터 14일입니다.</p>
            <p className="mt-2">철회권을 행사하려면 명확한 진술을 통해 계약을 철회하기로 한 결정을 당사({CONTACT.name}, {CONTACT.address}, 이메일: {emailLink()})에 알려야 합니다.</p>
            <p className="mt-2"><strong>참고:</strong> 디지털 콘텐츠의 철회권은 이행이 시작되고 소비자가 철회 기간 만료 전에 공급자가 이행을 시작한다는 데 명시적으로 동의한 경우 소멸됩니다.</p>
          </>
        ),
      },
      {
        heading: "제6조 해지",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>사용자는 언제든지 앱 설정 또는 이메일 연락을 통해 계정을 해지할 수 있습니다.</li>
            <li>유료 구독은 언제든지 취소할 수 있으며, 현재 청구 기간이 끝날 때 효력이 발생합니다.</li>
            <li>해지 후 모든 개인 데이터는 30일 이내에 영구적으로 삭제됩니다.</li>
          </ul>
        ),
      },
      {
        heading: "제7조 사용자 의무",
        content: (
          <>
            <p>사용자는 다음에 동의합니다:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>앱을 의도된 목적(가족 작업 관리)으로만 사용할 것</li>
              <li>불법적이거나 공격적이거나 유해한 콘텐츠를 업로드하지 않을 것</li>
              <li>애플리케이션의 보안을 침해하려 시도하지 않을 것</li>
              <li>앱을 상업적으로 재판매하거나 재허가하지 않을 것</li>
            </ul>
          </>
        ),
      },
      {
        heading: "제8조 책임 제한",
        content: (
          <>
            <p>Little Champs는 불가항력, 제3자의 기술적 장애 또는 남용으로 인한 손해에 대해 책임을 지지 않습니다.</p>
            <p className="mt-2">서비스 가용성을 목표로 하지만 보장하지는 않습니다. 계획된 유지보수는 가능한 경우 사전에 공지됩니다.</p>
          </>
        ),
      },
      {
        heading: "제9조 개인정보 보호",
        content: <p>개인 데이터 처리는 본 이용 약관의 일부를 구성하는 <a href="/privacy" className="underline font-medium">개인정보 처리방침</a>에 따릅니다.</p>,
      },
      {
        heading: "제10조 약관 변경",
        content: <p>최소 30일 전 공지를 통해 본 약관을 수정할 권리를 보유합니다. 사용자에게는 이메일로 통보됩니다. 사용자가 30일 이내에 이의를 제기하지 않으면 새로운 약관에 동의한 것으로 간주됩니다.</p>,
      },
      {
        heading: "제11조 준거법 및 관할 법원",
        content: <p>독일법이 적용됩니다. 사용자가 상인이거나 독일에 일반 관할권이 없는 경우 관할 법원은 함부르크입니다.</p>,
      },
      {
        heading: "제12조 최종 조항",
        content: <p>본 약관의 일부 조항이 무효이거나 무효가 되더라도 나머지 조항의 유효성은 영향을 받지 않습니다.</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },

  zh: {
    title: "用户协议（最终用户许可协议）",
    date: "最后更新：2026年6月",
    sections: [
      {
        heading: "第一条　适用范围",
        content: (
          <>
            <p>本用户协议适用于以下方运营的网络应用程序 <strong>Little Champs</strong> 的使用：</p>
            <p className="mt-2">{CONTACT.name}<br />{CONTACT.address}<br />电子邮件：{emailLink()}</p>
            <p className="mt-2">通过创建账户，用户即表示同意本用户协议。</p>
          </>
        ),
      },
      {
        heading: "第二条　服务说明",
        content: (
          <>
            <p>Little Champs 是一款家庭任务管理应用，通过游戏化元素（积分、奖励、排行榜）帮助儿童完成家务。该应用专为有子女的家庭设计，以软件即服务（SaaS）形式提供。</p>
            <p className="mt-2">提供多种订阅计划（Free、Family、FamilyPro）。功能范围取决于所选计划。</p>
          </>
        ),
      },
      {
        heading: "第三条　注册与用户账户",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>注册仅限成人（18岁及以上）。家长为其未成年子女创建账户。</li>
            <li>用户有义务在注册时提供准确信息并保持最新。</li>
            <li>登录凭据须保密。用户对其账户下进行的所有活动负责。</li>
            <li>账户不可转让。</li>
          </ul>
        ),
      },
      {
        heading: "第四条　订阅与支付条款",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>付费订阅按月或按年计费，除非及时取消，否则自动续订。</li>
            <li>付款通过 Stripe 或 Apple App Store 处理。相应的支付条款适用。</li>
            <li>除非另有说明，价格含适用税款。</li>
            <li>价格变更将在生效前至少30天通过电子邮件通知用户。</li>
          </ul>
        ),
      },
      {
        heading: "第五条　撤回权",
        content: (
          <>
            <p>消费者有权在14天内无需说明理由撤销合同。撤回期限为合同订立之日起14天。</p>
            <p className="mt-2">如需行使撤回权，请通过明确声明告知我们（{CONTACT.name}，{CONTACT.address}，电子邮件：{emailLink()}）您撤回合同的决定。</p>
            <p className="mt-2"><strong>注意：</strong>对于数字内容，一旦履行开始且消费者明确同意在撤回期届满前开始履行，撤回权即告失效。</p>
          </>
        ),
      },
      {
        heading: "第六条　取消",
        content: (
          <ul className="list-disc pl-6 space-y-2">
            <li>用户可随时通过应用设置或发送电子邮件取消账户。</li>
            <li>付费订阅可随时取消，于当前计费周期结束时生效。</li>
            <li>取消后，所有个人数据将在30天内永久删除。</li>
          </ul>
        ),
      },
      {
        heading: "第七条　用户义务",
        content: (
          <>
            <p>用户同意：</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>仅将应用用于预定目的（家庭任务管理）</li>
              <li>不上传非法、冒犯性或有害内容</li>
              <li>不尝试破坏应用程序的安全性</li>
              <li>不以商业目的转售或再许可应用</li>
            </ul>
          </>
        ),
      },
      {
        heading: "第八条　责任限制",
        content: (
          <>
            <p>Little Champs 对因不可抗力、第三方技术故障或滥用造成的损害不承担责任。</p>
            <p className="mt-2">我们努力保证服务可用性，但不作保证。计划内维护将尽可能提前公告。</p>
          </>
        ),
      },
      {
        heading: "第九条　隐私",
        content: <p>个人数据的处理受我们<a href="/privacy" className="underline font-medium">隐私政策</a>的约束，该政策构成本用户协议的一部分。</p>,
      },
      {
        heading: "第十条　条款变更",
        content: <p>我们保留至少提前30天通知修改本条款的权利。用户将通过电子邮件收到通知。如用户在30天内未提出异议，则视为接受新条款。</p>,
      },
      {
        heading: "第十一条　适用法律与管辖法院",
        content: <p>适用德国法律。若用户为商人或在德国没有一般管辖权，则管辖法院为汉堡。</p>,
      },
      {
        heading: "第十二条　最终条款",
        content: <p>如本协议中任何条款无效或变得无效，其余条款的有效性不受影响。</p>,
      },
    ],
    footer: `${CONTACT.name} · ${CONTACT.address} · ${CONTACT.email}`,
  },
};

// Fallback chain: exact match → language prefix → English → German
function getContent(lang: string): TermsContent {
  if (termsContent[lang]) return termsContent[lang];
  const prefix = lang.split("-")[0];
  if (termsContent[prefix]) return termsContent[prefix];
  return termsContent.en ?? termsContent.de;
}

export default function Terms() {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const content = getContent(i18n.language);

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
          {t("common.back")}
        </Button>

        <Card data-testid="card-terms">
          <CardHeader>
            <h1 className="text-2xl md:text-3xl font-semibold" data-testid="title-terms">
              {content.title}
            </h1>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <p className="text-muted-foreground">{content.date}</p>

            {content.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mt-6 mb-3">{section.heading}</h2>
                {section.content}
              </section>
            ))}

            <div className="pt-6 border-t border-border text-xs text-muted-foreground">
              <p>{content.footer}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
