import { useEffect } from "react";
import { useLocation } from "wouter";

export default function KidDashboardOld() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Automatically redirect to the new kid dashboard
    setLocation("/kid-dashboard");
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-lg mb-2">Weiterleitung...</div>
        <div className="text-sm text-muted-foreground">Du wirst zur neuen Kinderseite weitergeleitet.</div>
      </div>
    </div>
  );
}
