import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                "destructive-ghost":
                    "text-destructive hover:bg-destructive-soft",
                outline:
                    "border border-border-strong bg-card text-foreground hover:bg-accent",
                secondary: "bg-secondary text-foreground hover:bg-accent",
                ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                success:
                    "bg-success text-success-foreground hover:bg-success/90",
            },
            size: {
                default: "h-11 px-4 md:h-10",
                sm: "h-11 px-3 text-[13px] md:h-[34px]",
                lg: "h-12 px-6 text-[15px]",
                icon: "size-11 md:size-10",
                "icon-sm": "size-11 md:size-8",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

//eslint-disable-next-line
export { Button, buttonVariants };
