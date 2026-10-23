/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["'Public Sans'", "system-ui", "sans-serif"],
                mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
            },
            fontSize: {
                // Uppercase status labels
                "2xs": [
                    "11px",
                    { lineHeight: "14px", letterSpacing: "0.06em" },
                ],
            },
            borderRadius: {
                // 6 badges, 8 buttons/inputs, 10 segmented tracks/chips,
                // 12 menus/mobile cards, 16 desktop cards
                sm: "4px",
                md: "6px",
                lg: "var(--radius)",
                xl: "12px",
                "2xl": "16px",
                chip: "10px",
                "mobile-card": "14px",
            },
            boxShadow: {
                popover: "0 8px 24px rgba(0,0,0,.12)",
                segment: "0 1px 2px rgba(0,0,0,.08)",
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                faint: "hsl(var(--faint))",
                track: "hsl(var(--track))",
                hover: "hsl(var(--accent))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    soft: "hsl(var(--primary-soft))",
                    muted: "hsl(var(--primary-muted))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                    soft: "hsl(var(--destructive-soft))",
                },
                success: {
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                    soft: "hsl(var(--success-soft))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                    soft: "hsl(var(--warning-soft))",
                },
                border: {
                    DEFAULT: "hsl(var(--border))",
                    strong: "hsl(var(--border-strong))",
                },
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                    1: "hsl(var(--chart-1))",
                    2: "hsl(var(--chart-2))",
                    3: "hsl(var(--chart-3))",
                    4: "hsl(var(--chart-4))",
                    5: "hsl(var(--chart-5))",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground":
                        "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground":
                        "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))",
                },
            },
            keyframes: {
                "fade-in-up": {
                    from: { opacity: "0", transform: "translateY(6px)" },
                    to: { opacity: "1", transform: "none" },
                },
            },
            animation: {
                "fade-in-up": "fade-in-up .2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
