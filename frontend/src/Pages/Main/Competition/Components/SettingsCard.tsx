import { ChevronDown } from "lucide-react";
import { ReactNode, useId } from "react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
    /** Closed until opened, for settings rarely touched */
    collapsible?: boolean;
}

/** One group of competition settings, named so it reads as its own region */
const SettingsCard = ({
    title,
    description,
    children,
    className,
    collapsible = false,
}: SettingsCardProps) => {
    const titleId = useId();
    const header = (
        <>
            <CardTitle id={titleId} role="heading" aria-level={3}>
                {title}
            </CardTitle>
            <CardDescription className="text-[13px]">
                {description}
            </CardDescription>
        </>
    );
    const content = (
        <CardContent className="flex flex-col gap-4 md:gap-5">
            {children}
        </CardContent>
    );

    return (
        <Card
            role="region"
            aria-labelledby={titleId}
            className={cn("min-w-0", className)}
        >
            {collapsible ? (
                <details className="group">
                    <summary className="flex cursor-pointer select-none list-none items-start gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            {header}
                        </div>
                        <ChevronDown
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        />
                    </summary>
                    {content}
                </details>
            ) : (
                <>
                    <CardHeader>{header}</CardHeader>
                    {content}
                </>
            )}
        </Card>
    );
};

export default SettingsCard;
