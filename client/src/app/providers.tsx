"use client";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { useAppSelector } from "@/store/hooks";
import { applyTheme } from "@/lib/utils/theme";

// ThemeSync reads the theme from Redux and applies it to the DOM.
// Must be a child of the Redux Provider.
function ThemeSync() {
  const theme = useAppSelector(s => s.ui.theme);
  useEffect(() => {
    applyTheme(theme);
    // Listen for system preference changes when theme is "system"
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeSync />
      {children}
    </Provider>
  );
}