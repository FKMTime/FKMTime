import { cn } from "@/lib/utils";

interface ProgressBarProps {
    value: number;
    max: number;
    label: string;
    className?: string;
}

const ProgressBar = ({ value, max, label, className }: ProgressBarProps) => {
    const percent =
        max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            className={cn(
                "h-1.5 overflow-hidden rounded-full bg-track",
                className
            )}
        >
            <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};

export default ProgressBar;
