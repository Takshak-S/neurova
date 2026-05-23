// Theme utility — applies/removes the "dark" class on <html>
// Called on app init and whenever the user changes theme preference.

export type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme): void {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    if (theme === "dark") {
        root.classList.add("dark");
    } else if (theme === "light") {
        root.classList.remove("dark");
    } else {
        // system — follow OS preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }
}

export function getStoredTheme(): Theme {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("neurova_theme") as Theme) ?? "system";
}
