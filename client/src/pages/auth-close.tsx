import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function AuthClose() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      window.close();
      setClosed(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <p className="text-lg font-semibold">Eingeloggt!</p>
      {closed && (
        <p className="text-sm text-muted-foreground">
          Du kannst diesen Tab jetzt schließen.
        </p>
      )}
    </div>
  );
}
