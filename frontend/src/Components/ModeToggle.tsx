import { Check, Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";

const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

interface ModeToggleProps {
    variant?: "outline" | "ghost";
    className?: string;
}

const ModeToggle = ({ variant = "outline", className }: ModeToggleProps) => {
    const { theme, setTheme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={variant}
                    size="icon"
                    className={cn(
                        "relative md:size-[38px]",
                        variant === "outline" && "border-border",
                        className
                    )}
                    aria-label="Theme"
                >
                    <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem
                        key={value}
                        onClick={() => setTheme(value)}
                    >
                        <Icon />
                        {label}
                        <Check
                            className={cn(
                                "ml-auto !text-primary",
                                theme !== value && "invisible"
                            )}
                        />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ModeToggle;
