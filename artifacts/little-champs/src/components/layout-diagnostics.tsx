import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseServerBuild, readLayoutDiagnostics, WEB_BUILD_ID } from "@/lib/layout-diagnostics";

export function LayoutDiagnostics() {
  const native = Capacitor.isNativePlatform();
  const [metrics, setMetrics] = useState(() => readLayoutDiagnostics(native));
  const [appVersion, setAppVersion] = useState(native ? "Wird gelesen …" : "Webbrowser – keine installierte App-Version");
  const [serverBuild, setServerBuild] = useState("Wird geprüft …");
  const [revision, setRevision] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    let disposed = false;
    if (!native) return;
    const timeout = setTimeout(() => {
      if (!disposed) setAppVersion("Nicht verfügbar – keine Antwort vom nativen App-Plugin");
    }, 5000);
    import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (!disposed) setAppVersion(`${info.version} (Build ${info.build})`);
      })
      .catch(() => {
        if (!disposed) setAppVersion("Nicht verfügbar – natives App-Plugin nicht erreichbar");
      })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); };
  }, [native]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setMetrics(readLayoutDiagnostics(native)), 200);
    };
    setMetrics(readLayoutDiagnostics(native));
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    document.addEventListener("resume", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("resume", update);
    };
  }, [native, revision]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 5000);
    setServerBuild("Wird geprüft …");
    fetch(`${import.meta.env.BASE_URL}build-info.json`, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Webstand nicht abrufbar");
        const id = parseServerBuild(await response.json());
        if (!disposed) {
          setServerBuild(`${id} – ${id === WEB_BUILD_ID ? "entspricht geladenem Webstand" : "WEICHT vom geladenen Webstand AB"}`);
        }
      })
      .catch(() => {
        if (!disposed) setServerBuild("Nicht abrufbar – Netzwerkfehler oder Diagnose noch nicht veröffentlicht");
      })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [revision]);

  const report = {
    "Diagnose": "Little Champs / phone-layout-1",
    "Plattform": `${Capacitor.getPlatform()} (${native ? "native App" : "Browser"})`,
    "Installierte App-Version": appVersion,
    ...metrics,
    "Webstand vom Server": serverBuild,
  };
  const text = Object.entries(report).map(([key, value]) => `${key}: ${value}`).join("\n");

  return (
    <Card data-testid="card-layout-diagnostics">
      <CardHeader>
        <CardTitle>iOS- und Querformat-Diagnose</CardTitle>
        <CardDescription>
          Vorübergehende technische Anzeige. Im Hoch- und Querformat ablesen.
          Enthält keine Familieninhalte, Zugangsdaten oder persönlichen URL-Parameter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3 text-sm">
          {Object.entries(report).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-semibold">{key}</dt>
              <dd className="break-words text-muted-foreground" data-diagnostic={key}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setRevision((value) => value + 1); setCopyStatus(""); }} data-testid="button-refresh-layout-diagnostics">
            Diagnose aktualisieren
          </Button>
          <Button variant="outline" data-testid="button-copy-layout-diagnostics" onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopyStatus("Diagnose kopiert.");
            } catch {
              setCopyStatus("Kopieren nicht möglich. Den Text unten markieren und manuell kopieren.");
            }
          }}>
            Diagnose kopieren
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" role="status">{copyStatus}</p>
        <details>
          <summary className="cursor-pointer text-sm">Diagnosetext zum manuellen Kopieren</summary>
          <textarea aria-label="Diagnosetext" readOnly value={text} rows={12}
            className="mt-2 w-full rounded-md border bg-background p-3 text-xs text-foreground"
            onFocus={(event) => event.currentTarget.select()} />
        </details>
      </CardContent>
    </Card>
  );
}
