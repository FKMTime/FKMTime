import Logo from "@/assets/logo.svg?react";
import { cn } from "@/lib/utils";

// The stopwatch alone, for the collapsed sidebar
const MARK_VIEW_BOX = "26 50 168 202";

interface FkmLogoProps {
    /** "mark" shows only the stopwatch */
    variant?: "full" | "mark";
    className?: string;
}

/**
 * FKMTime logo. The stopwatch uses the current text colour, so it reads in
 * both themes; the red and yellow lettering is outlined and works on either.
 */
const FkmLogo = ({ variant = "full", className }: FkmLogoProps) => (
    <Logo
        role="img"
        aria-label="FKMTime"
        // Only set for "mark": viewBox={undefined} would erase the SVG's own
        {...(variant === "mark" && { viewBox: MARK_VIEW_BOX })}
        className={cn("h-9 w-auto shrink-0 text-foreground", className)}
    />
);

export default FkmLogo;
