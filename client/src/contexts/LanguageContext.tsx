import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Family } from "@shared/schema";

interface LanguageContextType {
  language: string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  isLoading: true,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string>("en");

  const { data: family, isLoading, isError } = useQuery<Family>({
    queryKey: ["/api/families/settings"],
    retry: 2,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (family?.language && family.language !== language) {
      setLanguage(family.language);
      i18n.changeLanguage(family.language);
    } else if (isError) {
      setLanguage("en");
      i18n.changeLanguage("en");
    }
  }, [family?.language, isError, i18n, language]);

  useEffect(() => {
    const ws = (window as any).__wsConnection;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "settings_updated" && message.settings?.language) {
          const newLanguage = message.settings.language;
          setLanguage(newLanguage);
          i18n.changeLanguage(newLanguage);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [i18n]);

  return (
    <LanguageContext.Provider value={{ language, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}
