import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring/40",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary-soft text-primary",
                success: "border-transparent bg-success-soft text-success",
                warning: "border-transparent bg-warning-soft text-warning",
                secondary:
                    "border-transparent bg-secondary text-muted-foreground",
                destructive:
                    "border-transparent bg-destructive-soft text-destructive",
                outline: "text-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

//eslint-disable-next-line
export { Badge, badgeVariants };
