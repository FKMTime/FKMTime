import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

// Matches the --background token so the PWA status bar blends in
const THEME_COLORS = { light: "#f5f6f8", dark: "#0f1217" };

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

    useEffect(() => {
        const root = window.document.documentElement;
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        const apply = () => {
            const resolved =
                theme === "system" ? (media.matches ? "dark" : "light") : theme;
            root.classList.remove("light", "dark");
            root.classList.add(resolved);
            document
                .querySelector('meta[name="theme-color"]')
                ?.setAttribute("content", THEME_COLORS[resolved]);
        };

        apply();
        if (theme !== "system") return;
        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, [theme]);

    const value = {
        theme,
        // eslint-disable-next-line no-shadow
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme);
            setTheme(theme);
        },
    };

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

//eslint-disable-next-line
export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");

    return context;
};
