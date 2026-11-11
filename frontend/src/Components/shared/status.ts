/**
 * Semantic status colours: success = done/ready, warning = delay/inspection,
 * destructive = incidents/destructive, primary = live/in progress.
 */
export type StatusTone =
    | "success"
    | "warning"
    | "destructive"
    | "primary"
    | "neutral";

export const STATUS_TEXT: Record<StatusTone, string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    primary: "text-primary",
    neutral: "text-muted-foreground",
};

export const STATUS_SOFT: Record<StatusTone, string> = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
    primary: "bg-primary-soft text-primary",
    neutral: "bg-secondary text-muted-foreground",
};

export const STATUS_DOT: Record<StatusTone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    primary: "bg-primary",
    neutral: "bg-faint",
};
