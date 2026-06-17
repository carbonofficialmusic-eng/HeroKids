import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    // One-time migration: if no preference stored, or the old default "light"
    // was never explicitly chosen by the user, migrate to "dark".
    // Users who intentionally switch to light via the profile menu set the
    // "theme-user-choice" flag, so their preference is preserved.
    const userExplicitlyChoseLight =
      stored === "light" && localStorage.getItem("theme-user-choice") === "1";
    if (!stored || (stored === "light" && !userExplicitlyChoseLight)) {
      localStorage.setItem("theme", "dark");
      return "dark";
    }
    return stored;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setThemeWithFlag = (newTheme: Theme) => {
    // Mark that the user has made an explicit choice so we respect it on reload
    localStorage.setItem("theme-user-choice", "1");
    setTheme(newTheme);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme: setThemeWithFlag }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
