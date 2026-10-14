import { Link } from "wouter";
import { ArrowLeft, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Contact() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Button variant="outline" asChild className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{t('landing.footer.contact')}</CardTitle>
            <CardDescription>
              {t('feedback.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="mailto:info@littlechamps.net">
                <Mail className="mr-2 h-4 w-4" />
                info@littlechamps.net
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}